import { Router } from "express";
import { execQuery } from "../config/database.js";

const router = Router();

// =============================================================================
// IMPACT ANALYSIS ROUTES
// All endpoints prefixed with /api/impact (mounted in server.js)
// =============================================================================

// ---------------------------------------------------------------------------
// POST /api/impact/analyze — Core impact analysis engine
// ---------------------------------------------------------------------------
router.post("/analyze", async (req, res) => {
  const {
    actionType,
    targetDatabase,
    targetSchema,
    targetObject,
    targetColumn = null,
    parameters = {},
    includeAiSuggestion = false,
  } = req.body;

  if (!actionType || !targetDatabase || !targetSchema || !targetObject) {
    return res.status(400).json({ error: "Missing required fields: actionType, targetDatabase, targetSchema, targetObject" });
  }

  try {
    const spSql = `
      CALL GET_IMPACT_ANALYSIS(
        '${actionType}',
        '${targetDatabase}',
        '${targetSchema}',
        '${targetObject}',
        ${targetColumn ? "'" + targetColumn + "'" : "NULL"},
        PARSE_JSON('${JSON.stringify(parameters).replace(/'/g, "''")}')
      )
    `;

    const rows = await execQuery(spSql);
    const result = rows && rows.length > 0 ? rows[0] : null;

    // SP returns a single row with VARIANT column
    const spOutput = result ? Object.values(result)[0] : null;
    let analysisResult = typeof spOutput === "string" ? JSON.parse(spOutput) : spOutput;

    if (!analysisResult || analysisResult.error) {
      return res.status(500).json({
        error: "Impact analysis failed",
        details: analysisResult?.message || "Unknown SP error",
      });
    }

    // Optionally call AI for suggestions
    if (includeAiSuggestion && analysisResult.impacts && analysisResult.impacts.length > 0) {
      try {
        const aiSuggestion = await getAiSuggestion(actionType, analysisResult);
        analysisResult.aiSuggestion = aiSuggestion;

        // Update audit log with AI suggestion
        const updateSql = `
          UPDATE R_IMPACT_AUDIT_LOG
          SET AI_SUGGESTION = ?
          WHERE ANALYSIS_ID = ?
        `;
        execQuery(updateSql, [aiSuggestion.summary || "", analysisResult.analysisId]).catch(() => {});
      } catch (aiErr) {
        analysisResult.aiSuggestion = { error: aiErr.message };
      }
    }

    return res.json(analysisResult);
  } catch (err) {
    console.error("[/api/impact/analyze] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/impact/alerts — List alerts with filters
// ---------------------------------------------------------------------------
router.get("/alerts", async (req, res) => {
  const {
    severity,
    acknowledged,
    sourceNode,
    limit = 50,
    offset = 0,
    dateFrom,
    dateTo,
  } = req.query;

  let where = "1=1";
  if (severity) where += ` AND SEVERITY = '${severity}'`;
  if (acknowledged !== undefined) where += ` AND ACKNOWLEDGED = ${acknowledged === "true"}`;
  if (sourceNode) where += ` AND SOURCE_NODE ILIKE '%${sourceNode}%'`;
  if (dateFrom) where += ` AND TIMESTAMP >= '${dateFrom}'`;
  if (dateTo) where += ` AND TIMESTAMP <= '${dateTo}'`;

  const sql = `
    SELECT * FROM R_IMPACT_ALERTS
    WHERE ${where}
    ORDER BY TIMESTAMP DESC
    LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
  `;

  const countSql = `SELECT COUNT(*) AS TOTAL FROM R_IMPACT_ALERTS WHERE ${where}`;

  const summarySql = `
    SELECT
      COUNT(CASE WHEN SEVERITY = 'HIGH' AND ACKNOWLEDGED = FALSE THEN 1 END) AS HIGH_UNACK,
      COUNT(CASE WHEN SEVERITY = 'MODERATE' AND ACKNOWLEDGED = FALSE THEN 1 END) AS MODERATE_UNACK,
      COUNT(CASE WHEN SEVERITY = 'WARNING' AND ACKNOWLEDGED = FALSE THEN 1 END) AS WARNING_UNACK
    FROM R_IMPACT_ALERTS
  `;

  try {
    const [rows, countRows, summaryRows] = await Promise.all([
      execQuery(sql),
      execQuery(countSql),
      execQuery(summarySql),
    ]);

    return res.json({
      alerts: rows,
      total: countRows[0]?.TOTAL || 0,
      summary: summaryRows[0] || {},
      filters: { severity, acknowledged, sourceNode, dateFrom, dateTo },
    });
  } catch (err) {
    console.error("[/api/impact/alerts] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/impact/alerts/:id/ack — Acknowledge an alert
// ---------------------------------------------------------------------------
router.put("/alerts/:id/ack", async (req, res) => {
  const { id } = req.params;
  const { resolutionNote = "" } = req.body;

  const sql = `
    UPDATE R_IMPACT_ALERTS
    SET ACKNOWLEDGED = TRUE,
        ACKNOWLEDGED_BY = CURRENT_USER(),
        ACKNOWLEDGED_AT = CURRENT_TIMESTAMP(),
        RESOLUTION_NOTE = ?
    WHERE ALERT_ID = ?
  `;

  try {
    await execQuery(sql, [resolutionNote, id]);
    return res.json({ success: true, alertId: id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/impact/alerts/:id/confirm — Confirm change was executed
// ---------------------------------------------------------------------------
router.put("/alerts/:id/confirm", async (req, res) => {
  const { id } = req.params;
  const { executedBy = "" } = req.body;

  const sql = `
    UPDATE R_IMPACT_ALERTS
    SET STATUS = 'EXECUTED',
        EXECUTED_BY = ?,
        EXECUTED_AT = CURRENT_TIMESTAMP()
    WHERE ANALYSIS_ID = (SELECT ANALYSIS_ID FROM R_IMPACT_ALERTS WHERE ALERT_ID = ?)
  `;

  try {
    await execQuery(sql, [executedBy || "CURRENT_USER", id]);
    return res.json({ success: true, alertId: id, status: "EXECUTED" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/impact/alerts/new — Get alerts newer than a timestamp (for polling)
// ---------------------------------------------------------------------------
router.get("/alerts/new", async (req, res) => {
  const { since } = req.query;
  if (!since) return res.status(400).json({ error: "Missing 'since' query parameter" });

  const sql = `
    SELECT * FROM R_IMPACT_ALERTS
    WHERE TIMESTAMP > ?
    ORDER BY TIMESTAMP DESC
  `;

  try {
    const rows = await execQuery(sql, [since]);
    return res.json({ alerts: rows, count: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/impact/alerts/:id — Dismiss an alert
// ---------------------------------------------------------------------------
router.delete("/alerts/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await execQuery(`DELETE FROM R_IMPACT_ALERTS WHERE ALERT_ID = ?`, [id]);
    return res.json({ success: true, alertId: id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/impact/history — Audit log of past analyses
// ---------------------------------------------------------------------------
router.get("/history", async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;

  const sql = `
    SELECT * FROM R_IMPACT_AUDIT_LOG
    ORDER BY TIMESTAMP DESC
    LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
  `;

  try {
    const rows = await execQuery(sql);
    return res.json({ history: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/impact/predict — AI-powered prediction via Cortex Agent
// ---------------------------------------------------------------------------
router.post("/predict", async (req, res) => {
  const { prompt, context } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const suggestion = await getAiSuggestion(context?.actionType || "GENERAL", context || {});
    return res.json(suggestion);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// CRUD: /api/impact/rules
// ---------------------------------------------------------------------------
router.get("/rules", async (req, res) => {
  try {
    const rows = await execQuery("SELECT * FROM R_IMPACT_RULES ORDER BY CREATED_AT DESC");
    return res.json({ rules: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/rules", async (req, res) => {
  const { ruleName, ruleDescription, conditionType, conditionValue, severityOverride, severityModifier } = req.body;

  const sql = `
    INSERT INTO R_IMPACT_RULES (RULE_NAME, RULE_DESCRIPTION, CONDITION_TYPE, CONDITION_VALUE, SEVERITY_OVERRIDE, SEVERITY_MODIFIER)
    SELECT ?, ?, ?, PARSE_JSON(?), ${severityOverride ? "'" + severityOverride + "'" : "NULL"}, ?
  `;

  try {
    await execQuery(sql, [ruleName, ruleDescription || "", conditionType, JSON.stringify(conditionValue), severityModifier || 0]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put("/rules/:id", async (req, res) => {
  const { id } = req.params;
  const { ruleName, ruleDescription, conditionType, conditionValue, severityOverride, severityModifier, isActive } = req.body;

  const sets = [];
  if (ruleName !== undefined) sets.push(`RULE_NAME = '${ruleName}'`);
  if (ruleDescription !== undefined) sets.push(`RULE_DESCRIPTION = '${(ruleDescription || "").replace(/'/g, "''")}'`);
  if (conditionType !== undefined) sets.push(`CONDITION_TYPE = '${conditionType}'`);
  if (conditionValue !== undefined) sets.push(`CONDITION_VALUE = PARSE_JSON('${JSON.stringify(conditionValue).replace(/'/g, "''")}')`);
  if (severityOverride !== undefined) sets.push(`SEVERITY_OVERRIDE = ${severityOverride ? "'" + severityOverride + "'" : "NULL"}`);
  if (severityModifier !== undefined) sets.push(`SEVERITY_MODIFIER = ${severityModifier}`);
  if (isActive !== undefined) sets.push(`IS_ACTIVE = ${isActive}`);

  if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });

  const sql = `UPDATE R_IMPACT_RULES SET ${sets.join(", ")} WHERE RULE_ID = '${id}'`;

  try {
    await execQuery(sql);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/rules/:id", async (req, res) => {
  try {
    await execQuery(`DELETE FROM R_IMPACT_RULES WHERE RULE_ID = ?`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// CRUD: /api/impact/subscriptions
// ---------------------------------------------------------------------------
router.get("/subscriptions", async (req, res) => {
  try {
    const rows = await execQuery("SELECT * FROM R_IMPACT_SUBSCRIPTIONS WHERE IS_ACTIVE = TRUE ORDER BY CREATED_AT DESC");
    return res.json({ subscriptions: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/subscriptions", async (req, res) => {
  const { userEmail, objectPattern, minSeverity = "WARNING", notifyEmail = true, notifyInApp = true } = req.body;

  const sql = `
    INSERT INTO R_IMPACT_SUBSCRIPTIONS (USER_EMAIL, OBJECT_PATTERN, MIN_SEVERITY, NOTIFY_EMAIL, NOTIFY_IN_APP)
    VALUES (?, ?, ?, ?, ?)
  `;

  try {
    await execQuery(sql, [userEmail, objectPattern || "%", minSeverity, notifyEmail, notifyInApp]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/subscriptions/:id", async (req, res) => {
  try {
    await execQuery(`UPDATE R_IMPACT_SUBSCRIPTIONS SET IS_ACTIVE = FALSE WHERE SUBSCRIPTION_ID = ?`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// HELPER: AI Suggestion via Cortex Agent
// =============================================================================
async function getAiSuggestion(actionType, context) {
  const HOST = process.env.SNOWFLAKE_HOST || "PIHJDMO-SFCOCOHOL.snowflakecomputing.com";
  const DATABASE = process.env.SNOWFLAKE_DATABASE || "D_IN_CAPG_POC_AI_SCALABILITY";
  const SCHEMA = process.env.SNOWFLAKE_SCHEMA || "AI_SCALABILITY_SCHEMA";
  const AUTH_TOKEN = process.env.SNOWFLAKE_AUTH_TOKEN;
  const AGENT_NAME = "LINEAGE360";

  if (!AUTH_TOKEN) {
    return { summary: "AI suggestion unavailable (no auth token)", steps: [] };
  }

  const targetObj = context.targetObject || context.targetFqn || "unknown";
  const impactCount = context.totalAffected || 0;
  const highCount = context.summary?.high || 0;

  const prompt = `You are an expert data pipeline impact analyst. Analyze this proposed change and provide a mitigation plan:

**Proposed Action:** ${actionType}
**Target Object:** ${targetObj}
**Impact Summary:** ${impactCount} objects affected (${highCount} HIGH severity)
**Top Impacts:** ${JSON.stringify((context.impacts || []).slice(0, 5).map(i => ({ node: i.node, severity: i.severity, willBreak: i.willBreak })))}

Respond with:
1. A 1-2 sentence summary of the risk
2. Numbered mitigation steps (max 5)
3. An alternative approach if one exists

Keep response concise and actionable.`;

  try {
    const axios = (await import("axios")).default;
    const url = `https://${HOST}/api/v2/databases/${DATABASE}/schemas/${SCHEMA}/agents/${AGENT_NAME}:run`;

    const response = await axios.post(
      url,
      {
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        tool_choice: { type: "auto" },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
        responseType: "text",
        timeout: 30000,
      }
    );

    let answerText = "";
    const responseData = typeof response.data === "string" ? response.data : JSON.stringify(response.data);

    const textMatch = responseData.match(/"text"\s*:\s*"([^"]+)"/);
    if (textMatch) {
      answerText = textMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    } else {
      answerText = responseData.substring(0, 2000);
    }

    const lines = answerText.split("\n").filter((l) => l.trim());
    const steps = lines.filter((l) => /^\d+[\.\)]/.test(l.trim()));

    return {
      summary: lines[0] || "AI analysis complete.",
      steps: steps.length > 0 ? steps : lines.slice(1, 6),
      fullText: answerText,
      alternativeApproach: lines.find((l) => l.toLowerCase().includes("alternative")) || null,
    };
  } catch (err) {
    return {
      summary: `AI suggestion unavailable: ${err.message}`,
      steps: [],
      error: err.message,
    };
  }
}

// =============================================================================
// DDL GENERATION & PASSWORD-PROTECTED EXECUTION
// =============================================================================

// ---------------------------------------------------------------------------
// POST /api/impact/generate-ddl — Generate SQL for the proposed change
// ---------------------------------------------------------------------------
router.post("/generate-ddl", async (req, res) => {
  const { actionType, targetDatabase, targetSchema, targetObject, targetColumn, parameters } = req.body;

  if (!actionType || !targetDatabase || !targetSchema || !targetObject) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const fqn = `${targetDatabase}.${targetSchema}.${targetObject}`;
  let ddlStatements = [];
  let warning = null;

  // ── Detect object type (TABLE, VIEW, DYNAMIC TABLE, etc.) from metadata ──
  let objectType = "TABLE"; // default fallback
  try {
    const typeResult = await execQuery(
      `SELECT TABLE_TYPE FROM ${targetDatabase}.INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [targetSchema, targetObject]
    );
    if (typeResult && typeResult.length > 0) {
      const rawType = typeResult[0].TABLE_TYPE; // e.g., "BASE TABLE", "VIEW", "DYNAMIC TABLE"
      if (rawType === "VIEW") objectType = "VIEW";
      else if (rawType === "DYNAMIC TABLE") objectType = "DYNAMIC TABLE";
      else objectType = "TABLE";
    }
  } catch (e) {
    // If metadata lookup fails, fall back to name-based detection
    const upperName = targetObject.toUpperCase();
    if (upperName.startsWith("VW_") || upperName.startsWith("V_") || upperName.includes("_VW_") || upperName.includes("_VIEW")) {
      objectType = "VIEW";
    }
  }

  // Helper: correct ALTER keyword for object type (views use ALTER VIEW in some ops)
  const alterKeyword = objectType === "VIEW" ? "ALTER VIEW" : "ALTER TABLE";
  const dropKeyword = objectType === "VIEW" ? "DROP VIEW" : objectType === "DYNAMIC TABLE" ? "DROP DYNAMIC TABLE" : "DROP TABLE";

  switch (actionType) {
    case "NODE_DELETE":
      ddlStatements = [`${dropKeyword} IF EXISTS ${fqn};`];
      if (objectType === "VIEW") {
        warning = "This will permanently drop the view definition. Downstream objects referencing this view will break.";
      } else if (objectType === "DYNAMIC TABLE") {
        warning = "This will permanently drop the dynamic table. The refresh pipeline and all downstream consumers will break.";
      } else {
        warning = "This will permanently delete the table and all its data. Time Travel may allow recovery within the retention period.";
      }
      break;

    case "COLUMN_DELETE":
      if (!targetColumn) return res.status(400).json({ error: "targetColumn required for COLUMN_DELETE" });
      if (objectType === "VIEW") {
        ddlStatements = [
          `-- Views do not support DROP COLUMN directly. You must recreate the view without the column.`,
          `-- Example: CREATE OR REPLACE VIEW ${fqn} AS SELECT <other_columns> FROM <source>;`,
        ];
        warning = `Views cannot have columns dropped directly. Recreate the view excluding ${targetColumn}.`;
      } else {
        ddlStatements = [`ALTER TABLE ${fqn} DROP COLUMN ${targetColumn};`];
        warning = `Column ${targetColumn} will be permanently removed from ${targetObject}.`;
      }
      break;

    case "COLUMN_RENAME":
      if (!targetColumn) return res.status(400).json({ error: "targetColumn required for COLUMN_RENAME" });
      const newName = parameters?.newName || `${targetColumn}_RENAMED`;
      if (objectType === "VIEW") {
        ddlStatements = [
          `-- Views do not support RENAME COLUMN. Recreate the view with the new alias.`,
          `-- Example: CREATE OR REPLACE VIEW ${fqn} AS SELECT ${targetColumn} AS ${newName}, ... FROM <source>;`,
        ];
        warning = `Views cannot rename columns directly. Recreate the view with ${targetColumn} aliased as ${newName}.`;
      } else {
        ddlStatements = [`ALTER TABLE ${fqn} RENAME COLUMN ${targetColumn} TO ${newName};`];
        warning = `All downstream objects referencing ${targetColumn} will need to be updated to use ${newName}.`;
      }
      break;

    case "TYPE_CHANGE":
      if (!targetColumn) return res.status(400).json({ error: "targetColumn required for TYPE_CHANGE" });
      const newType = parameters?.newType || "VARCHAR(500)";
      if (objectType === "VIEW") {
        ddlStatements = [
          `-- Views inherit column types from their source. Cast in the view definition instead.`,
          `-- Example: CREATE OR REPLACE VIEW ${fqn} AS SELECT CAST(${targetColumn} AS ${newType}) AS ${targetColumn}, ... FROM <source>;`,
        ];
        warning = `Views don't have independent column types. Update the source table or add a CAST in the view definition.`;
      } else {
        ddlStatements = [`ALTER TABLE ${fqn} ALTER COLUMN ${targetColumn} SET DATA TYPE ${newType};`];
        warning = `Changing data type may cause casting errors in downstream objects.`;
      }
      break;

    case "SCHEMA_MOVE":
      const newSchema = parameters?.newSchema || "NEW_SCHEMA";
      ddlStatements = [
        `${alterKeyword} ${fqn} SET SCHEMA ${targetDatabase}.${newSchema};`,
      ];
      warning = `All references to ${fqn} will break unless updated to the new schema path.`;
      break;

    case "COLUMN_ADD":
      const colName = targetColumn || "NEW_COLUMN";
      const colType = parameters?.columnType || "VARCHAR(200)";
      if (objectType === "VIEW") {
        ddlStatements = [
          `-- Views cannot have columns added. Recreate the view with the additional column from source.`,
          `-- Example: CREATE OR REPLACE VIEW ${fqn} AS SELECT *, <source_column> AS ${colName} FROM <source>;`,
        ];
        warning = `Views cannot have columns added directly. Update the view definition to include the new column.`;
      } else {
        ddlStatements = [`ALTER TABLE ${fqn} ADD COLUMN ${colName} ${colType};`];
        warning = null; // Additive, no risk
      }
      break;

    case "SOURCE_DISCONNECT":
      ddlStatements = [
        `-- Source disconnect: Remove external lineage registration`,
        `DELETE FROM R_EXTERNAL_LINEAGE_SOURCES WHERE TARGET_DATABASE = '${targetDatabase}' AND TARGET_SCHEMA = '${targetSchema}' AND TARGET_TABLE = '${targetObject}';`,
      ];
      warning = "This removes the registered external source. The actual external connection is managed outside Snowflake.";
      break;

    case "DEPENDENCY_CHANGE":
      const newSource = parameters?.newSource || "<NEW_SOURCE_TABLE>";
      ddlStatements = [
        `-- Dependency change: Update the ${objectType.toLowerCase()} to read from a new source`,
        `-- You will need to manually update the CREATE ${objectType} or INSERT/MERGE statement`,
        `-- Example: CREATE OR REPLACE ${objectType} ${fqn} AS SELECT * FROM ${newSource};`,
      ];
      warning = "Dependency changes require manual SQL editing. The generated SQL is a template only.";
      break;

    default:
      return res.status(400).json({ error: `Unsupported action type: ${actionType}` });
  }

  return res.json({
    actionType,
    target: fqn,
    objectType,
    ddlStatements,
    warning,
    canExecute: !["DEPENDENCY_CHANGE"].includes(actionType) && !ddlStatements.every(s => s.startsWith("--")),
  });
});

// ---------------------------------------------------------------------------
// POST /api/impact/execute-ddl — Execute DDL (uses app's existing connection)
// ---------------------------------------------------------------------------
router.post("/execute-ddl", async (req, res) => {
  const { ddlStatements, analysisId, actionType, targetObject } = req.body;

  if (!ddlStatements || !Array.isArray(ddlStatements) || ddlStatements.length === 0) {
    return res.status(400).json({ error: "No DDL statements provided" });
  }

  // Filter out comment-only statements
  const executableStatements = ddlStatements.filter(s => !s.trim().startsWith("--"));
  if (executableStatements.length === 0) {
    return res.status(400).json({ error: "No executable statements (only comments found)" });
  }

  const username = process.env.SNOWFLAKE_USER || "unknown";

  try {
    // Execute DDL statements using the app's existing connection
    const results = [];
    for (const stmt of executableStatements) {
      try {
        await execQuery(stmt);
        results.push({ statement: stmt, status: "SUCCESS" });
      } catch (stmtErr) {
        results.push({ statement: stmt, status: "FAILED", error: stmtErr.message });
      }
    }

    // Auto-confirm the alerts as EXECUTED
    if (analysisId) {
      try {
        await execQuery(`UPDATE R_IMPACT_ALERTS SET STATUS = 'EXECUTED', EXECUTED_BY = ?, EXECUTED_AT = CURRENT_TIMESTAMP() WHERE ANALYSIS_ID = ?`, [username, analysisId]);
      } catch (e) { /* non-fatal */ }
    }

    // Log to audit
    try {
      await execQuery(`INSERT INTO R_IMPACT_AUDIT_LOG (ANALYSIS_ID, ACTION_TYPE, TARGET_OBJECT, STATUS, PARAMETERS) SELECT ?, ?, ?, 'EXECUTED', PARSE_JSON(?)`, [analysisId || "manual", actionType || "DDL_EXECUTE", targetObject || "unknown", JSON.stringify({ ddlStatements: executableStatements, results })]);
    } catch (e) { /* non-fatal */ }

    const allSuccess = results.every(r => r.status === "SUCCESS");
    return res.json({
      success: allSuccess,
      results,
      message: allSuccess ? "All statements executed successfully." : "Some statements failed. Check results.",
    });

  } catch (err) {
    return res.status(500).json({ error: `Execution failed: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// POST /api/impact/schedule-ddl — Schedule DDL for later execution
// ---------------------------------------------------------------------------
router.post("/schedule-ddl", async (req, res) => {
  const { ddlStatements, scheduledAt, analysisId, actionType, targetObject } = req.body;

  if (!ddlStatements || !Array.isArray(ddlStatements) || ddlStatements.length === 0) {
    return res.status(400).json({ error: "No DDL statements provided" });
  }
  if (!scheduledAt) {
    return res.status(400).json({ error: "scheduledAt is required" });
  }

  const username = process.env.SNOWFLAKE_USER || "unknown";

  try {
    // Generate a schedule ID
    const idResult = await execQuery("SELECT UUID_STRING() AS ID");
    const scheduleId = idResult[0]?.ID || `sched_${Date.now()}`;

    await execQuery(
      `INSERT INTO R_IMPACT_SCHEDULED_DDL (ID, DDL_STATEMENTS, SCHEDULED_AT, STATUS, CREATED_BY, ANALYSIS_ID, ACTION_TYPE, TARGET_OBJECT)
       SELECT ?, PARSE_JSON(?), ?::TIMESTAMP_NTZ, 'PENDING', ?, ?, ?, ?`,
      [scheduleId, JSON.stringify(ddlStatements), scheduledAt, username, analysisId || null, actionType || null, targetObject || null]
    );

    return res.json({
      success: true,
      scheduleId,
      scheduledAt,
      message: `DDL scheduled for execution at ${scheduledAt}`,
    });
  } catch (err) {
    return res.status(500).json({ error: `Scheduling failed: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// GET /api/impact/scheduled — List scheduled DDL executions
// ---------------------------------------------------------------------------
router.get("/scheduled", async (req, res) => {
  try {
    const rows = await execQuery(`SELECT ID, SCHEDULED_AT, STATUS, CREATED_BY, CREATED_AT, ACTION_TYPE, TARGET_OBJECT, ERROR_MESSAGE
                FROM R_IMPACT_SCHEDULED_DDL ORDER BY SCHEDULED_AT DESC LIMIT 50`);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/impact/scheduled/:id — Cancel a scheduled DDL
// ---------------------------------------------------------------------------
router.delete("/scheduled/:id", async (req, res) => {
  try {
    await execQuery(`UPDATE R_IMPACT_SCHEDULED_DDL SET STATUS = 'CANCELLED' WHERE ID = ? AND STATUS = 'PENDING'`, [req.params.id]);
    return res.json({ success: true, message: "Schedule cancelled" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
