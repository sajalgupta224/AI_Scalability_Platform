import express from "express";
import connection from "../config/database.js";
 
import {
  getDatabases,
  getSchemas,
  getTablesFromProcedure,
  getTablesBySchema,
} from "../controllers/snowflakeMeta.controller.js";
 
import { generateSemanticSQL } from "../controllers/SemanticView.controller.js";
 
const router = express.Router();
 
const DEFAULT_WAREHOUSE = process.env.SNOWFLAKE_WAREHOUSE || "SNOW_CAP_SPC";
 
/* ---------------- Helpers ---------------- */
 
const dq = (s) => `"${String(s).replace(/"/g, '""')}"`;
 
const execQuery = (sqlText) =>
  new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      complete: (err, _stmt, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    });
  });
 
const execWithBinds = (sqlText, binds = []) =>
  new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    });
  });
 
/* ---------------- Existing routes (unchanged) ---------------- */
 
router.get("/databases", getDatabases);
router.get("/schemas", getSchemas);
router.get("/procedure", getTablesFromProcedure);
router.get("/tables", getTablesBySchema);
router.post("/semantic-model", generateSemanticSQL);
 
/* ---------------- ✅ Add WHOAMI (your 404 fix) ---------------- */
 
router.get("/whoami", async (_req, res) => {
  try {
    const rows = await execQuery(`
      SELECT
        CURRENT_ROLE() AS ROLE,
        CURRENT_DATABASE() AS DB,
        CURRENT_SCHEMA() AS SCHEMA,
        CURRENT_WAREHOUSE() AS WH
    `);
    return res.json(rows?.[0] || {});
  } catch (err) {
    console.error("[/api/whoami] Failed:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch session info", message: err?.message || String(err) });
  }
});
 
/* ---------------- Columns API (working) ---------------- */
 
router.get("/columns", async (req, res) => {
  const { db, schema, table } = req.query;
 
  if (!db || !schema || !table) {
    return res.status(400).json({
      error: "Database, schema and table are required",
    });
  }
 
  try {
    const sql = `SHOW COLUMNS IN TABLE ${dq(db)}.${dq(schema)}.${dq(table)}`;
    const rows = await execQuery(sql);

    const formatType = (raw) => {
      if (!raw) return "";
      if (typeof raw !== "string") return String(raw);
      try {
        const parsed = JSON.parse(raw);
        const t = (parsed.type || "").toUpperCase();
        if (t === "FIXED") {
          const scale = parsed.scale ?? 0;
          const precision = parsed.precision ?? 38;
          return scale === 0 ? `NUMBER(${precision},0)` : `NUMBER(${precision},${scale})`;
        }
        if (t === "TEXT") {
          return parsed.length ? `VARCHAR(${parsed.length})` : "VARCHAR";
        }
        if (t === "REAL") return "FLOAT";
        return t || raw;
      } catch {
        return raw;
      }
    };

    const columns = rows
      .map((r) => ({
        name: r.column_name ?? r.COLUMN_NAME ?? r.name ?? r.NAME ?? r[2] ?? r[1],
        type: formatType(r.data_type ?? r.DATA_TYPE ?? r.type ?? r.TYPE),
      }))
      .filter((c) => c.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json(columns);
  } catch (err) {
    console.error("[/api/columns] Failed:", err?.message || err);
    return res.status(500).json({
      error: "Failed to fetch columns",
      message: err?.message || String(err),
    });
  }
});
 
/* ---------------- ✅ Create Search Service (fixed) ---------------- */
 
router.post("/create-search-service", async (req, res) => {
  const {
    db,
    schema,
    table,
    textColumn,
    attributeColumns = [],
    name,        // pipeline name (used to derive service name)
    serviceName, // optional explicit override
  } = req.body || {};
 
  // domain extraction (removes env suffix like dev/prod)
  function getDomainFromPipeline(pipelineName) {
    if (!pipelineName) return "";
    const parts = String(pipelineName)
      .trim()
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
 
    if (parts.length === 0) return "";
 
    const envSet = new Set([
      "dev","test","stage","staging","prod","production","uat","perf","sandbox",
    ]);
 
    const last = parts[parts.length - 1];
    const core = envSet.has(last) ? parts.slice(0, -1) : parts;
    return core.join("_");
  }
 
  // format: r_<domain>_search_service
  function deriveServiceNameFromPipeline(pipelineName) {
    const domain = getDomainFromPipeline(pipelineName) || "default";
    const cleaned = domain
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
 
    return `r_${cleaned || "default"}_search_service`;
  }
 
  try {
    if (!db || !schema || !table || !textColumn) {
      return res.status(400).json({
        error: "db, schema, table and textColumn are required",
      });
    }
 
    if (!serviceName && !name) {
      return res.status(400).json({
        error: "Either serviceName or pipeline name (name) must be provided",
      });
    }
 
    const finalServiceName = serviceName || deriveServiceNameFromPipeline(name);
    const derivedDomain = getDomainFromPipeline(name);
 
    // 1) Verify table exists
    const tableCheckSql = `
      SELECT 1
      FROM ${dq(db)}.INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      LIMIT 1
    `;
    const tblRows = await execWithBinds(tableCheckSql, [
      String(schema).toUpperCase(),
      String(table).toUpperCase(),
    ]);
 
    if (!tblRows || tblRows.length === 0) {
      return res.status(404).json({
        error: `Table not found: ${db}.${schema}.${table}`,
      });
    }
 
    // 2) Fetch column types
    const colsSql = `
      SELECT COLUMN_NAME, DATA_TYPE
      FROM ${dq(db)}.INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `;
    const cols = await execWithBinds(colsSql, [
      String(schema).toUpperCase(),
      String(table).toUpperCase(),
    ]);
 
    const byName = new Map(
      cols.map((r) => [
        String(r.COLUMN_NAME || r.column_name).toUpperCase(),
        String(r.DATA_TYPE || r.data_type).toUpperCase(),
      ])
    );
 
    const tColUpper = String(textColumn).toUpperCase();
    if (!byName.has(tColUpper)) {
      return res.status(400).json({ error: `textColumn not found: ${textColumn}` });
    }
 
    const textType = byName.get(tColUpper) || "";
    const isText =
      textType.includes("TEXT") ||
      textType.includes("CHAR") ||
      textType.includes("STRING");
 
    const missingAttrs = (attributeColumns || []).filter(
      (c) => !byName.has(String(c).toUpperCase())
    );
    if (missingAttrs.length) {
      return res.status(400).json({
        error: `Attribute columns not found: ${missingAttrs.join(", ")}`,
      });
    }
 
    // 3) Fully qualified table + fully qualified service name
    const fqTable = `${dq(db)}.${dq(schema)}.${dq(table)}`;
 
    // ✅ CRITICAL FIX: qualify service name to avoid CURRENT_SCHEMA issues
    const fqService = `${dq(db)}.${dq(schema)}.${dq(finalServiceName)}`;
 
    const qAttrsList = (attributeColumns || []).map(dq).join(", ");
 
    // 4) SELECT list must include ON column name
    const selectListParts = [];
    if (isText) {
      selectListParts.push(`${dq(textColumn)}`);
    } else {
      selectListParts.push(`CAST(${dq(textColumn)} AS VARCHAR) AS ${dq(textColumn)}`);
    }
 
    for (const col of attributeColumns || []) {
      selectListParts.push(dq(col));
    }
 
    const selectList = selectListParts.join(",\n        ");
 
    // 5) Final SQL (warehouse fixed)
    const sql = `
CREATE OR REPLACE CORTEX SEARCH SERVICE ${fqService}
ON ${dq(textColumn)}
${attributeColumns?.length ? `ATTRIBUTES ${qAttrsList}` : ""}
WAREHOUSE = ${dq(DEFAULT_WAREHOUSE)}
TARGET_LAG = '1 minute'
AS (
  SELECT
        ${selectList}
  FROM ${fqTable}
);`;
 
    console.log("Create Search Service SQL:\n", sql);
 
    await execQuery(sql);
 
    return res.json({
      ok: true,
      serviceName: finalServiceName,
      qualifiedServiceName: `${db}.${schema}.${finalServiceName}`,
      domain: derivedDomain,
      message: `Cortex Search Service '${finalServiceName}' created successfully`,
      generatedSQL: sql,
    });
  } catch (err) {
    console.error("Failed to create search service:", err);
    return res.status(500).json({
      error: "Failed to create Cortex Search Service",
      message: err?.message ?? String(err),
    });
  }
});
 
export default router;
 