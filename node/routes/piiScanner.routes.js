import { Router } from "express";
import { execQuery } from "../config/database.js";

const router = Router();

// In-memory set of active scan IDs (for quick cancel check without DB round-trip)
const activeScanIds = new Set();

// =============================================================================
// PII SCANNER ROUTES
// All endpoints prefixed with /api/pii (mounted in server.js)
// =============================================================================

// ---------------------------------------------------------------------------
// POST /api/pii/scan — Trigger PII scan (async — returns immediately)
// ---------------------------------------------------------------------------
router.post("/scan", async (req, res) => {
  const { database, schema, table } = req.body;

  if (!database || !schema) {
    return res.status(400).json({ error: "Missing required fields: database, schema" });
  }

  try {
    const scanId = crypto.randomUUID();

    let tablesToScan = [];
    if (table) {
      tablesToScan = [table];
    } else {
      const tablesResult = await execQuery(
        `SELECT TABLE_NAME FROM ${database}.INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')`,
        [schema]
      );
      tablesToScan = tablesResult.map(r => r.TABLE_NAME);
    }

    const totalTables = tablesToScan.length;

    // Create scan history record with total
    await execQuery(
      `INSERT INTO R_PII_SCAN_HISTORY (SCAN_ID, DATABASE_NAME, SCHEMA_NAME, TABLE_NAME, TABLES_TOTAL, STATUS)
       SELECT ?, ?, ?, ?, ?, 'RUNNING'`,
      [scanId, database, schema, table || null, totalTables]
    );

    // Return immediately — scan runs in background
    res.json({ scanId, totalTables, status: "RUNNING" });

    // --- Background scan execution ---
    activeScanIds.add(scanId);
    const BATCH_SIZE = 5;
    let tablesScanned = 0;
    let totalPiiFound = 0;
    let totalColumnsScanned = 0;

    for (let i = 0; i < tablesToScan.length; i += BATCH_SIZE) {
      // Check if cancelled
      if (!activeScanIds.has(scanId)) break;
      const checkStatus = await execQuery(
        `SELECT STATUS FROM R_PII_SCAN_HISTORY WHERE SCAN_ID = ?`, [scanId]
      );
      if (checkStatus?.[0]?.STATUS === 'CANCELLED') {
        activeScanIds.delete(scanId);
        break;
      }

      // Process batch in parallel
      const batch = tablesToScan.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (tbl) => {
          try {
            const result = await execQuery(
              `CALL SCAN_TABLE_FOR_PII(?, ?, ?, ?)`,
              [database, schema, tbl, scanId]
            );
            if (result && result[0]) {
              const spResult = typeof result[0].SCAN_TABLE_FOR_PII === 'string'
                ? JSON.parse(result[0].SCAN_TABLE_FOR_PII)
                : result[0].SCAN_TABLE_FOR_PII;
              return { piiFound: spResult.piiFound || 0, columnsScanned: spResult.columnsScanned || 0 };
            }
            return { piiFound: 0, columnsScanned: 0 };
          } catch { return { piiFound: 0, columnsScanned: 0 }; }
        })
      );

      batchResults.forEach(r => {
        totalPiiFound += r.piiFound;
        totalColumnsScanned += r.columnsScanned;
      });
      tablesScanned += batch.length;

      // Update progress in DB
      await execQuery(
        `UPDATE R_PII_SCAN_HISTORY SET TABLES_SCANNED = ?, COLUMNS_SCANNED = ?, PII_FOUND = ? WHERE SCAN_ID = ?`,
        [tablesScanned, totalColumnsScanned, totalPiiFound, scanId]
      );
    }

    // Final status update
    activeScanIds.delete(scanId);
    const finalCheck = await execQuery(`SELECT STATUS FROM R_PII_SCAN_HISTORY WHERE SCAN_ID = ?`, [scanId]);
    if (finalCheck?.[0]?.STATUS === 'RUNNING') {
      await execQuery(
        `UPDATE R_PII_SCAN_HISTORY 
         SET STATUS = 'COMPLETED', COMPLETED_AT = CURRENT_TIMESTAMP(),
             TABLES_SCANNED = ?, COLUMNS_SCANNED = ?, PII_FOUND = ?
         WHERE SCAN_ID = ?`,
        [tablesScanned, totalColumnsScanned, totalPiiFound, scanId]
      );
    }
  } catch (err) {
    console.error("PII scan error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Scan failed: " + err.message });
    }
  }
});

// ---------------------------------------------------------------------------
// GET /api/pii/progress/:scanId — Live scan progress
// ---------------------------------------------------------------------------
router.get("/progress/:scanId", async (req, res) => {
  try {
    const rows = await execQuery(
      `SELECT SCAN_ID, TABLES_SCANNED, TABLES_TOTAL, COLUMNS_SCANNED, PII_FOUND, STATUS, 
              TO_VARCHAR(STARTED_AT, 'YYYY-MM-DD"T"HH24:MI:SS') AS STARTED_AT, COMPLETED_AT
       FROM R_PII_SCAN_HISTORY WHERE SCAN_ID = ?`,
      [req.params.scanId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Scan not found" });
    }

    const row = rows[0];
    const tablesScanned = row.TABLES_SCANNED || 0;
    const tablesTotal = row.TABLES_TOTAL || 1;
    const percent = Math.round((tablesScanned / tablesTotal) * 100);

    // Calculate ETA
    let eta = null;
    if (row.STATUS === 'RUNNING' && tablesScanned > 0 && row.STARTED_AT) {
      const startedAt = new Date(row.STARTED_AT + 'Z'); // Snowflake NTZ → treat as UTC
      const elapsedMs = Date.now() - startedAt.getTime();
      const msPerTable = elapsedMs / tablesScanned;
      const remaining = tablesTotal - tablesScanned;
      eta = Math.round((msPerTable * remaining) / 1000);
    }

    res.json({
      scanId: row.SCAN_ID,
      percent,
      tablesScanned,
      tablesTotal,
      columnsScanned: row.COLUMNS_SCANNED || 0,
      piiFound: row.PII_FOUND || 0,
      eta,
      status: row.STATUS,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/pii/cancel/:scanId — Cancel a running scan
// ---------------------------------------------------------------------------
router.post("/cancel/:scanId", async (req, res) => {
  try {
    activeScanIds.delete(req.params.scanId);
    await execQuery(
      `UPDATE R_PII_SCAN_HISTORY SET STATUS = 'CANCELLED', COMPLETED_AT = CURRENT_TIMESTAMP() WHERE SCAN_ID = ? AND STATUS = 'RUNNING'`,
      [req.params.scanId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/pii/results — Get scan results with optional filters
// ---------------------------------------------------------------------------
router.get("/results", async (req, res) => {
  const { database, schema, table, status, piiType, scanId } = req.query;

  try {
    let sql = `SELECT * FROM R_PII_SCAN_RESULTS WHERE 1=1`;
    const binds = [];

    if (scanId) { sql += ` AND SCAN_ID = ?`; binds.push(scanId); }
    if (database) { sql += ` AND DATABASE_NAME = ?`; binds.push(database); }
    if (schema) { sql += ` AND SCHEMA_NAME = ?`; binds.push(schema); }
    if (table) { sql += ` AND TABLE_NAME = ?`; binds.push(table); }
    if (status) { sql += ` AND STATUS = ?`; binds.push(status); }
    if (piiType) { sql += ` AND PII_TYPE = ?`; binds.push(piiType); }

    sql += ` ORDER BY DETECTED_AT DESC`;

    const results = await execQuery(sql, binds);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/pii/summary — Dashboard KPIs
// ---------------------------------------------------------------------------
router.get("/summary", async (req, res) => {
  try {
    const stats = await execQuery(`
      SELECT 
        COUNT(DISTINCT TABLE_NAME) AS TABLES_WITH_PII,
        COUNT(*) AS TOTAL_PII_COLUMNS,
        SUM(CASE WHEN STATUS = 'DETECTED' THEN 1 ELSE 0 END) AS UNPROTECTED,
        SUM(CASE WHEN STATUS = 'MASKED' THEN 1 ELSE 0 END) AS MASKED,
        SUM(CASE WHEN STATUS = 'IGNORED' THEN 1 ELSE 0 END) AS IGNORED,
        ROUND(
          CASE WHEN COUNT(*) > 0 
            THEN (SUM(CASE WHEN STATUS IN ('MASKED', 'IGNORED') THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
            ELSE 100 
          END, 1
        ) AS COMPLIANCE_SCORE
      FROM R_PII_SCAN_RESULTS
      WHERE STATUS != 'RESOLVED'
    `);

    const byType = await execQuery(`
      SELECT PII_TYPE, COUNT(*) AS COUNT
      FROM R_PII_SCAN_RESULTS
      WHERE STATUS != 'RESOLVED'
      GROUP BY PII_TYPE
      ORDER BY COUNT DESC
    `);

    res.json({
      ...(stats[0] || {}),
      byType: byType || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/pii/mask — Generate and apply a masking policy
// ---------------------------------------------------------------------------
router.post("/mask", async (req, res) => {
  const { resultId, database, schema, table, column, piiType, maskType } = req.body;

  if (!database || !schema || !table || !column || !maskType) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const policyName = `MASK_${piiType || 'PII'}_${table}_${column}`.toUpperCase();
    let policySql = "";

    switch (maskType) {
      case "FULL":
        policySql = `CREATE OR REPLACE MASKING POLICY ${database}.${schema}.${policyName}
  AS (val STRING) RETURNS STRING ->
  CASE WHEN CURRENT_ROLE() IN ('SYSADMIN','ACCOUNTADMIN') THEN val ELSE '********' END;`;
        break;
      case "PARTIAL":
        policySql = `CREATE OR REPLACE MASKING POLICY ${database}.${schema}.${policyName}
  AS (val STRING) RETURNS STRING ->
  CASE WHEN CURRENT_ROLE() IN ('SYSADMIN','ACCOUNTADMIN') THEN val ELSE LEFT(val, 2) || '****' || RIGHT(val, 2) END;`;
        break;
      case "HASH":
        policySql = `CREATE OR REPLACE MASKING POLICY ${database}.${schema}.${policyName}
  AS (val STRING) RETURNS STRING ->
  CASE WHEN CURRENT_ROLE() IN ('SYSADMIN','ACCOUNTADMIN') THEN val ELSE SHA2(val) END;`;
        break;
      case "REDACT":
        policySql = `CREATE OR REPLACE MASKING POLICY ${database}.${schema}.${policyName}
  AS (val STRING) RETURNS STRING ->
  CASE WHEN CURRENT_ROLE() IN ('SYSADMIN','ACCOUNTADMIN') THEN val ELSE '[REDACTED]' END;`;
        break;
      default:
        return res.status(400).json({ error: "Invalid maskType. Use FULL, PARTIAL, HASH, or REDACT" });
    }

    // Determine if object is a view or table
    const objCheck = await execQuery(
      `SELECT TABLE_TYPE FROM ${database}.INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [schema, table]
    );
    const isView = objCheck && objCheck.length > 0 && objCheck[0].TABLE_TYPE === 'VIEW';
    const alterCmd = isView ? 'ALTER VIEW' : 'ALTER TABLE';

    const applySql = `${alterCmd} ${database}.${schema}.${table} 
  MODIFY COLUMN ${column} SET MASKING POLICY ${database}.${schema}.${policyName};`;

    // Execute policy creation
    await execQuery(policySql);
    // Apply to column
    await execQuery(applySql);

    // Record in tracking table
    await execQuery(
      `INSERT INTO R_PII_MASKING_POLICIES 
       (POLICY_NAME, DATABASE_NAME, SCHEMA_NAME, TABLE_NAME, COLUMN_NAME, PII_TYPE, MASK_TYPE, POLICY_SQL)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?`,
      [policyName, database, schema, table, column, piiType || 'UNKNOWN', maskType, policySql + '\n' + applySql]
    );

    // Update scan result status
    if (resultId) {
      await execQuery(
        `UPDATE R_PII_SCAN_RESULTS SET STATUS = 'MASKED', IS_MASKED = TRUE, MASKING_POLICY_NAME = ? WHERE ID = ?`,
        [policyName, resultId]
      );
    }

    res.json({ success: true, policyName, policySql, applySql });
  } catch (err) {
    res.status(500).json({ error: "Masking failed: " + err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/pii/mask/:id — Remove a masking policy
// ---------------------------------------------------------------------------
router.delete("/mask/:id", async (req, res) => {
  try {
    const policy = await execQuery(
      `SELECT * FROM R_PII_MASKING_POLICIES WHERE ID = ?`,
      [req.params.id]
    );

    if (!policy || policy.length === 0) {
      return res.status(404).json({ error: "Policy not found" });
    }

    const p = policy[0];

    // Remove policy from column
    await execQuery(
      `ALTER TABLE ${p.DATABASE_NAME}.${p.SCHEMA_NAME}.${p.TABLE_NAME} 
       MODIFY COLUMN ${p.COLUMN_NAME} UNSET MASKING POLICY`
    );

    // Drop the policy
    await execQuery(`DROP MASKING POLICY IF EXISTS ${p.DATABASE_NAME}.${p.SCHEMA_NAME}.${p.POLICY_NAME}`);

    // Update tracking
    await execQuery(`UPDATE R_PII_MASKING_POLICIES SET IS_ACTIVE = FALSE WHERE ID = ?`, [req.params.id]);

    // Revert scan result status
    await execQuery(
      `UPDATE R_PII_SCAN_RESULTS 
       SET STATUS = 'DETECTED', IS_MASKED = FALSE, MASKING_POLICY_NAME = NULL
       WHERE DATABASE_NAME = ? AND SCHEMA_NAME = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [p.DATABASE_NAME, p.SCHEMA_NAME, p.TABLE_NAME, p.COLUMN_NAME]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/pii/history — Scan run history
// ---------------------------------------------------------------------------
router.get("/history", async (req, res) => {
  try {
    // Auto-mark old stuck scans (RUNNING for > 30 min) as FAILED
    await execQuery(
      `UPDATE R_PII_SCAN_HISTORY SET STATUS = 'FAILED', COMPLETED_AT = CURRENT_TIMESTAMP()
       WHERE STATUS = 'RUNNING' AND STARTED_AT < DATEADD('minute', -30, CURRENT_TIMESTAMP())`
    );

    const rows = await execQuery(
      `SELECT SCAN_ID, DATABASE_NAME, SCHEMA_NAME, TABLE_NAME, SCANNED_BY,
              TO_VARCHAR(STARTED_AT, 'YYYY-MM-DD"T"HH24:MI:SS') AS STARTED_AT,
              TO_VARCHAR(COMPLETED_AT, 'YYYY-MM-DD"T"HH24:MI:SS') AS COMPLETED_AT,
              TABLES_SCANNED, TABLES_TOTAL, COLUMNS_SCANNED, PII_FOUND, STATUS
       FROM R_PII_SCAN_HISTORY ORDER BY STARTED_AT DESC LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/pii/by-object — PII data for a specific table (used by lineage nodes)
// ---------------------------------------------------------------------------
router.get("/by-object", async (req, res) => {
  const { database, schema, table } = req.query;

  if (!database || !schema || !table) {
    return res.status(400).json({ error: "Missing database, schema, or table" });
  }

  try {
    const results = await execQuery(
      `SELECT COLUMN_NAME, PII_TYPE, CONFIDENCE, STATUS, IS_MASKED, MASKING_POLICY_NAME
       FROM R_PII_SCAN_RESULTS
       WHERE DATABASE_NAME = ? AND SCHEMA_NAME = ? AND TABLE_NAME = ? AND STATUS != 'RESOLVED'
       ORDER BY CONFIDENCE DESC`,
      [database, schema, table]
    );

    const piiCount = results.length;
    const unprotected = results.filter(r => r.STATUS === 'DETECTED').length;
    const masked = results.filter(r => r.STATUS === 'MASKED').length;
    
    let piiStatus = 'none';
    if (piiCount > 0) {
      if (unprotected === 0) piiStatus = 'masked';
      else if (masked > 0) piiStatus = 'partial';
      else piiStatus = 'unprotected';
    }

    res.json({ piiCount, piiStatus, unprotected, masked, columns: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/pii/flow — Trace a PII column through the lineage graph
// ---------------------------------------------------------------------------
router.get("/flow", async (req, res) => {
  const { database, schema, table, column } = req.query;

  if (!database || !schema || !table || !column) {
    return res.status(400).json({ error: "Missing required params: database, schema, table, column" });
  }

  try {
    // Get downstream lineage for this object
    const lineageSql = `
      SELECT DOWNSTREAM_DATABASE_NAME, DOWNSTREAM_SCHEMA_NAME, DOWNSTREAM_TABLE_NAME, DOWNSTREAM_COLUMN_NAME
      FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY,
           LATERAL FLATTEN(input => DIRECT_OBJECTS_ACCESSED) src,
           LATERAL FLATTEN(input => OBJECTS_MODIFIED) dst
      WHERE src.value:objectName = ?
        AND src.value:columns[0]:columnName = ?
      GROUP BY 1, 2, 3, 4
      LIMIT 20
    `;

    // Fallback: use our own lineage data to trace column flow
    const fqn = `${database}.${schema}.${table}`;
    const downstreamSql = `
      SELECT DISTINCT r.DATABASE_NAME, r.SCHEMA_NAME, r.TABLE_NAME, r.COLUMN_NAME, r.PII_TYPE, r.STATUS
      FROM R_PII_SCAN_RESULTS r
      WHERE r.COLUMN_NAME = ? 
        AND r.STATUS != 'RESOLVED'
        AND CONCAT(r.DATABASE_NAME, '.', r.SCHEMA_NAME, '.', r.TABLE_NAME) != ?
      ORDER BY r.TABLE_NAME
    `;

    const results = await execQuery(downstreamSql, [column, fqn]);

    res.json({
      sourceTable: fqn,
      sourceColumn: column,
      downstream: results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/pii/ignore — Mark a PII detection as ignored (false positive)
// ---------------------------------------------------------------------------
router.post("/ignore", async (req, res) => {
  const { resultId } = req.body;

  if (!resultId) {
    return res.status(400).json({ error: "Missing resultId" });
  }

  try {
    await execQuery(`UPDATE R_PII_SCAN_RESULTS SET STATUS = 'IGNORED' WHERE ID = ?`, [resultId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/pii/unmask — Remove masking policy by table+column lookup
// ---------------------------------------------------------------------------
router.post("/unmask", async (req, res) => {
  const { database, schema, table, column } = req.body;

  if (!database || !schema || !table || !column) {
    return res.status(400).json({ error: "Missing required fields: database, schema, table, column" });
  }

  try {
    // Find the active policy for this column
    const policies = await execQuery(
      `SELECT * FROM R_PII_MASKING_POLICIES 
       WHERE DATABASE_NAME = ? AND SCHEMA_NAME = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND IS_ACTIVE = TRUE
       ORDER BY APPLIED_AT DESC LIMIT 1`,
      [database, schema, table, column]
    );

    if (!policies || policies.length === 0) {
      return res.status(404).json({ error: "No active masking policy found for this column" });
    }

    const p = policies[0];

    // Determine if object is a view or table
    const objCheck = await execQuery(
      `SELECT TABLE_TYPE FROM ${database}.INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [schema, table]
    );
    const isView = objCheck && objCheck.length > 0 && objCheck[0].TABLE_TYPE === 'VIEW';
    const alterCmd = isView ? 'ALTER VIEW' : 'ALTER TABLE';

    // Remove policy from column
    await execQuery(
      `${alterCmd} ${database}.${schema}.${table} MODIFY COLUMN ${column} UNSET MASKING POLICY`
    );

    // Drop the policy object
    await execQuery(`DROP MASKING POLICY IF EXISTS ${database}.${schema}.${p.POLICY_NAME}`);

    // Update tracking table
    await execQuery(`UPDATE R_PII_MASKING_POLICIES SET IS_ACTIVE = FALSE WHERE ID = ?`, [p.ID]);

    // Revert scan result status
    await execQuery(
      `UPDATE R_PII_SCAN_RESULTS 
       SET STATUS = 'DETECTED', IS_MASKED = FALSE, MASKING_POLICY_NAME = NULL
       WHERE DATABASE_NAME = ? AND SCHEMA_NAME = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND STATUS = 'MASKED'`,
      [database, schema, table, column]
    );

    res.json({ success: true, removedPolicy: p.POLICY_NAME });
  } catch (err) {
    res.status(500).json({ error: "Unmask failed: " + err.message });
  }
});

export default router;
