
// backend/controllers/snowflakeMeta.controller.js
import { execQuery } from "../config/database.js";
import { logAuditError } from "../helpers/errorLogger.js";

const ok = (res, data, message = "OK") =>
  res.status(200).json({ success: true, data, message });

const fail = (res, message, status = 500, error = "SERVER_ERROR", details) =>
  res.status(status).json({
    success: false,
    data: null,
    error,
    message,
    ...(details ? { details } : {}),
  });

/**
 * ✅ GET /api/databases
 */
export const getDatabases = async (req, res) => {
  try {
    const rows = await execQuery("SHOW DATABASES like 'd%'");///for pipeline we are only showing databases starting with d
    const data = (rows || [])
      .map((r) => r?.name ?? r?.NAME ?? r?.[1])
      .filter(Boolean)
      .sort();

    return ok(res, data, "Databases fetched successfully");
  } catch (e) {
     logAuditError({
      eventType: 'ERROR',
      errorMessage: e.message || String(e),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: e.statementId || 'UNKNOWN'
    });
    console.error("SHOW DATABASES failed:", e);
    return fail(res, "Failed to fetch databases", 500, "DATABASE_ERROR", e?.message);
  }
};

/**
 * ✅ GET /api/schemas?db=DB_NAME
 */
export const getSchemas = async (req, res) => {
  const db = req.query.db;
  if (!db) {
    return fail(res, "Database name required (db)", 400, "VALIDATION_ERROR");
  }

  try {
    const safeDb = `"${String(db).replace(/"/g, '""')}"`;
    const rows = await execQuery(`SHOW SCHEMAS IN DATABASE ${safeDb}`);

    const data = (rows || [])
      .map((r) => r?.name ?? r?.NAME ?? r?.[1])
      .filter(Boolean)
      .sort();

    return ok(res, data, "Schemas fetched successfully");
  } catch (e) {
     logAuditError({
      eventType: 'ERROR',
      errorMessage: e.message || String(e),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: e.statementId || 'UNKNOWN'
    });
    console.error("SHOW SCHEMAS failed:", e);
    return fail(res, "Failed to fetch schemas", 500, "DATABASE_ERROR", e?.message);
  }
};

/**
 * ✅ GET /api/procedure
 * (kept for compatibility - uses your existing SP_LIST_TABLES)
 */
export const getTablesFromProcedure = async (req, res) => {
  try {
    const rows = await execQuery("CALL AI_SCALABILITY_SCHEMA.SP_LIST_TABLES();");
    const tables = rows?.[0]?.SP_LIST_TABLES ?? [];
    return ok(res, tables, "Tables fetched successfully (procedure)");
  } catch (e) {
     logAuditError({
      eventType: 'ERROR',
      errorMessage: e.message || String(e),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: e.statementId || 'UNKNOWN'
    });
    console.error("SP_LIST_TABLES failed:", e);
    return fail(res, "Failed to fetch tables (procedure)", 500, "DATABASE_ERROR", e?.message);
  }
};

/**
 * ✅ NEW: GET /api/tables?db=DB_NAME&schema=SCHEMA_NAME
 * This is the correct endpoint for your dropdown (DB+Schema specific).
 */
export const getTablesBySchema = async (req, res) => {
  const db = req.query.db;
  const schema = req.query.schema;

  if (!db || !schema) {
    return fail(res, "db and schema are required", 400, "VALIDATION_ERROR");
  }

  try {
    const safeDb = `"${String(db).replace(/"/g, '""')}"`;
    const safeSchema = `"${String(schema).replace(/"/g, '""')}"`;

    const rows = await execQuery(`SHOW TABLES IN SCHEMA ${safeDb}.${safeSchema}`);

    const data = (rows || [])
      .map((r) => r?.name ?? r?.NAME ?? r?.[1])
      .filter(Boolean)
      .sort();

    return ok(res, data, "Tables fetched successfully");
  } catch (e) {
     logAuditError({
      eventType: 'ERROR',
      errorMessage: e.message || String(e),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: e.statementId || 'UNKNOWN'
    });
    console.error("SHOW TABLES failed:", e);
    return fail(res, "Failed to fetch tables", 500, "DATABASE_ERROR", e?.message);
  }
};




