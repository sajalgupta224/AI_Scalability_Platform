
// backend/controllers/semanticview.controller.js
import connection from "../config/database.js";
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

const quoteIdent = (s) => `"${String(s).replace(/"/g, '""')}"`;

/**
 * Optional: GET /api/semantic/health
 */
export const semanticHealth = (req, res) => {
  return ok(res, { status: "semantic view routes healthy" }, "Semantic routes healthy");
};

/**
 * ✅ POST /api/semantic-model
 * Body: { modelName, database, schema, tables: ["T1","T2"] }
 * Calls: D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.GENERATE_SEMANTIC_MODEL_WITH_DESCRIPTION
 * Returns: { success:true, data:{ sql:"..." } }
 */
export const generateSemanticSQL = (req, res) => {
  try {
    const { modelName, database, schema, tables } = req.body || {};

    if (!modelName || !database || !schema || !Array.isArray(tables) || tables.length === 0) {
      return fail(
        res,
        "Body must include: modelName (string), database (string), schema (string), tables (non-empty array).",
        400,
        "VALIDATION_ERROR"
      );
    }

    const tableList = tables.map(String).map((t) => t.trim()).filter(Boolean);
    if (!tableList.length) {
      return fail(res, "No tables provided.", 400, "VALIDATION_ERROR");
    }

    // ✅ Procedure location (fixed as per Snowflake team)
    const PROC_DB = process.env.SNOWFLAKE_DATABASE;
    const PROC_SCHEMA = process.env.SNOWFLAKE_SCHEMA;

    const procFqn = `${quoteIdent(PROC_DB)}.${quoteIdent(PROC_SCHEMA)}.GENERATE_SEMANTIC_MODEL_WITH_DESCRIPTION`;

    const arrayPlaceholders = tableList.map(() => "?").join(", ");
    const sqlText = `
      CALL ${procFqn}(
        ?, ?, ?, ARRAY_CONSTRUCT(${arrayPlaceholders})
      );
    `;

    // ✅ These are procedure input params (Snowflake team example)
    const binds = [modelName, database, schema, ...tableList];

    connection.execute({
      sqlText,
      binds,
      complete: (err, stmt, rows) => {
        if (err) {
          console.error("Stored procedure call failed:", err);
          return fail(res, "Error generating semantic SQL", 500, "DATABASE_ERROR", err.message);
        }

        const firstRow = rows?.[0] || null;
        const output = firstRow ? Object.values(firstRow)[0] : null;

        if (!output) {
          return fail(res, "No SQL returned from stored procedure", 500, "DATABASE_ERROR");
        }

        // ✅ Return SQL in a consistent place
        return ok(res, { sql: String(output) }, "Semantic SQL generated successfully");
      },
    });
  } catch (e) {
     logAuditError({
      eventType: 'ERROR',
      errorMessage: e.message || String(e),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: e.statementId || 'UNKNOWN'
    });
    console.error("Unexpected error:", e);
    return fail(res, "Internal server error", 500, "SERVER_ERROR", e?.message);
  }
};
