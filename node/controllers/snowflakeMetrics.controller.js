import { execQuery } from "../config/database.js";

const ok = (res, data, message = "OK") =>
  res.status(200).json({ success: true, data, message });

const fail = (res, message, status = 500, details) =>
  res.status(status).json({ success: false, data: null, message, ...(details ? { details } : {}) });

/* ─── helpers ─── */
const parseDays = (req) => {
  const d = parseInt(req.query.days, 10);
  return d > 0 && d <= 90 ? d : 30;
};

// const WH = "W_IN_CAPG_AI_SCALABILITY_SOL_XS";

/**
 * Parse the database filter from query params.
 * Returns the sanitized database name or empty string (meaning "all databases").
 */
const parseDatabase = (req) => {
  const db = req.query.database || req.body?.database || "";
  // Sanitize: allow only alphanumeric, underscore, dash, dot
  return db.replace(/[^a-zA-Z0-9_.\-]/g, "");
};

/**
 * Parse the warehouse filter from query params.
 * Returns the sanitized warehouse name or empty string (meaning "all warehouses").
 */
const parseWarehouse = (req) => {
  const wh = req.query.warehouse || "";
  return wh.replace(/[^a-zA-Z0-9_.\-]/g, "");
};

/**
 * Build a SQL AND clause for DATABASE_NAME filtering.
 * Returns empty string if no database is selected (show all).
 */
const dbFilter = (req, column = "DATABASE_NAME") => {
  const db = parseDatabase(req);
  if (!db) return "";
  return `AND ${column} = '${db}'`;
};

/**
 * Build a SQL AND clause for WAREHOUSE_NAME filtering.
 * Returns empty string if no warehouse is selected (show all).
 */
const whFilter = (req, column = "WAREHOUSE_NAME") => {
  const wh = parseWarehouse(req);
  if (!wh) return "";
  return `AND ${column} = '${wh}'`;
};

/**
 * For heavy QUERY_HISTORY queries: cap days at 7 when no database filter to avoid timeout.
 */
const safeDays = (req) => {
  const days = parseDays(req);
  const db = parseDatabase(req);
  // If no database filter, limit to 7 days max to avoid scanning entire account
  if (!db && days > 7) return 7;
  return days;
};

/* ═══════════════════════════════════════════════
   0. Lookup / Filter Dropdowns
   ═══════════════════════════════════════════════ */

/** GET /api/sf-metrics/warehouses */
export const getWarehouses = async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT DISTINCT WAREHOUSE_NAME
      FROM VW_WAREHOUSE_METERING_HISTORY
      ORDER BY WAREHOUSE_NAME
    `);
    return ok(res, rows, "Warehouses fetched");
  } catch (e) {
    console.error("[warehouses]", e?.message);
    return fail(res, "Failed to fetch warehouses", 500, e?.message);
  }
};

/** GET /api/sf-metrics/databases */
export const getDatabases = async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT DATABASE_NAME
      FROM VW_DATABASES
      WHERE DELETED IS NULL
      ORDER BY DATABASE_NAME
    `);
    return ok(res, rows, "Databases fetched");
  } catch (e) {
    console.error("[databases]", e?.message);
    return fail(res, "Failed to fetch databases", 500, e?.message);
  }
};

/* ═══════════════════════════════════════════════
   1. Credit & Cost Metrics
   ═══════════════════════════════════════════════ */

/** GET /api/sf-metrics/warehouse-credit-usage */
export const getWarehouseCreditUsage = async (req, res) => {
  const days = parseDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        WAREHOUSE_NAME,
        TO_CHAR(START_TIME, 'YYYY-MM-DD') AS USAGE_DATE,
        SUM(CREDITS_USED) AS CREDITS_USED,
        SUM(CREDITS_USED_COMPUTE) AS CREDITS_COMPUTE,
        SUM(CREDITS_USED_CLOUD_SERVICES) AS CREDITS_CLOUD
      FROM VW_WAREHOUSE_METERING_HISTORY
      WHERE START_TIME >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
        ${whFilter(req)}
      GROUP BY WAREHOUSE_NAME, USAGE_DATE
      ORDER BY USAGE_DATE DESC
      LIMIT 500
    `);
    return ok(res, rows, "Warehouse credit usage fetched");
  } catch (e) {
    console.error("[warehouse-credit-usage]", e?.message);
    return fail(res, "Failed to fetch warehouse credit usage", 500, e?.message);
  }
};

/** GET /api/sf-metrics/daily-metering */
export const getDailyMetering = async (req, res) => {
  const days = parseDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        SERVICE_TYPE,
        TO_CHAR(USAGE_DATE, 'YYYY-MM-DD') AS USAGE_DATE,
        CREDITS_USED,
        CREDITS_BILLED,
        CREDITS_ADJUSTMENT_CLOUD_SERVICES
      FROM VW_METERING_DAILY_HISTORY
      WHERE USAGE_DATE >= DATEADD('day', -${days}, CURRENT_DATE())
      ORDER BY USAGE_DATE DESC
      LIMIT 500
    `);
    return ok(res, rows, "Daily metering fetched");
  } catch (e) {
    console.error("[daily-metering]", e?.message);
    return fail(res, "Failed to fetch daily metering", 500, e?.message);
  }
};

/** GET /api/sf-metrics/cortex-ai-credits */
export const getCortexAICredits = async (req, res) => {
  const days = parseDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        FUNCTION_NAME,
        MODEL_NAME,
        TO_CHAR(START_TIME, 'YYYY-MM-DD') AS USAGE_DATE,
        SUM(CREDITS) AS CREDITS,
        COUNT(*) AS CALL_COUNT
      FROM VW_CORTEX_AI_FUNCTIONS_USAGE_HISTORY
      WHERE START_TIME >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
      GROUP BY FUNCTION_NAME, MODEL_NAME, USAGE_DATE
      ORDER BY USAGE_DATE DESC
      LIMIT 200
    `);
    return ok(res, rows, "Cortex AI credits fetched");
  } catch (e) {
    console.error("[cortex-ai-credits]", e?.message);
    return fail(res, "Failed to fetch Cortex AI credits", 500, e?.message);
  }
};

/** GET /api/sf-metrics/cortex-agent-credits */
export const getCortexAgentCredits = async (req, res) => {
  const days = parseDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        AGENT_NAME,
        AGENT_DATABASE_NAME,
        USER_NAME,
        TO_CHAR(START_TIME, 'YYYY-MM-DD') AS USAGE_DATE,
        TOKENS,
        TOKEN_CREDITS
      FROM VW_CORTEX_AGENT_USAGE_HISTORY
      WHERE START_TIME >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
        ${dbFilter(req, "AGENT_DATABASE_NAME")}
      ORDER BY START_TIME DESC
      LIMIT 500
    `);
    return ok(res, rows, "Cortex Agent credits fetched");
  } catch (e) {
    console.error("[cortex-agent-credits]", e?.message);
    return fail(res, "Failed to fetch Cortex Agent credits", 500, e?.message);
  }
};

/* ═══════════════════════════════════════════════
   2. Query Performance Metrics
   ═══════════════════════════════════════════════ */

/** GET /api/sf-metrics/query-performance */
export const getQueryPerformance = async (req, res) => {
  const days = safeDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        COUNT(*) AS TOTAL_QUERIES,
        AVG(TOTAL_ELAPSED_TIME) / 1000 AS AVG_DURATION_SEC,
        APPROX_PERCENTILE(TOTAL_ELAPSED_TIME, 0.95) / 1000 AS P95_DURATION_SEC,
        SUM(CASE WHEN EXECUTION_STATUS = 'FAIL' THEN 1 ELSE 0 END) AS FAILED_QUERIES,
        AVG(QUEUED_OVERLOAD_TIME) / 1000 AS AVG_QUEUED_SEC,
        AVG(TRANSACTION_BLOCKED_TIME) / 1000 AS AVG_BLOCKED_SEC,
        AVG(BYTES_SCANNED) AS AVG_BYTES_SCANNED,
        AVG(ROWS_PRODUCED) AS AVG_ROWS_PRODUCED
      FROM VW_QUERY_HISTORY
      WHERE START_TIME >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
        ${dbFilter(req)}
        ${whFilter(req)}
    `);
    return ok(res, rows, "Query performance fetched");
  } catch (e) {
    console.error("[query-performance]", e?.message);
    return fail(res, "Failed to fetch query performance", 500, e?.message);
  }
};

/** GET /api/sf-metrics/query-trend */
export const getQueryTrend = async (req, res) => {
  const days = safeDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        TO_CHAR(START_TIME, 'YYYY-MM-DD') AS QUERY_DATE,
        COUNT(*) AS TOTAL_QUERIES,
        AVG(TOTAL_ELAPSED_TIME) / 1000 AS AVG_DURATION_SEC,
        SUM(CASE WHEN EXECUTION_STATUS = 'FAIL' THEN 1 ELSE 0 END) AS FAILED_QUERIES,
        AVG(QUEUED_OVERLOAD_TIME) / 1000 AS AVG_QUEUED_SEC
      FROM VW_QUERY_HISTORY
      WHERE START_TIME >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
        ${dbFilter(req)}
        ${whFilter(req)}
      GROUP BY QUERY_DATE
      ORDER BY QUERY_DATE DESC
    `);
    return ok(res, rows, "Query trend fetched");
  } catch (e) {
    console.error("[query-trend]", e?.message);
    return fail(res, "Failed to fetch query trend", 500, e?.message);
  }
};

/* ═══════════════════════════════════════════════
   3. Storage Metrics
   ═══════════════════════════════════════════════ */

/** GET /api/sf-metrics/database-storage */
export const getDatabaseStorage = async (req, res) => {
  const days = parseDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        DATABASE_NAME,
        TO_CHAR(USAGE_DATE, 'YYYY-MM-DD') AS USAGE_DATE,
        AVERAGE_DATABASE_BYTES / POWER(1024,3) AS AVG_DB_GB,
        AVERAGE_FAILSAFE_BYTES / POWER(1024,3) AS AVG_FAILSAFE_GB
      FROM VW_DATABASE_STORAGE_USAGE_HISTORY
      WHERE USAGE_DATE >= DATEADD('day', -${days}, CURRENT_DATE())
      ORDER BY USAGE_DATE DESC
      LIMIT 500
    `);
    return ok(res, rows, "Database storage fetched");
  } catch (e) {
    console.error("[database-storage]", e?.message);
    return fail(res, "Failed to fetch database storage", 500, e?.message);
  }
};

/** GET /api/sf-metrics/table-storage */
export const getTableStorage = async (req, res) => {
  const db = parseDatabase(req);
  try {
    const rows = await execQuery(`
      SELECT
        TABLE_CATALOG,
        TABLE_SCHEMA,
        TABLE_NAME,
        ACTIVE_BYTES / POWER(1024,2) AS ACTIVE_MB,
        TIME_TRAVEL_BYTES / POWER(1024,2) AS TIME_TRAVEL_MB,
        FAILSAFE_BYTES / POWER(1024,2) AS FAILSAFE_MB,
        RETAINED_FOR_CLONE_BYTES / POWER(1024,2) AS CLONE_MB
      FROM VW_TABLE_STORAGE_METRICS
      ${db ? `WHERE TABLE_CATALOG = '${db}'` : ""}
      ORDER BY ACTIVE_BYTES DESC
      LIMIT 100
    `);
    return ok(res, rows, "Table storage fetched");
  } catch (e) {
    console.error("[table-storage]", e?.message);
    return fail(res, "Failed to fetch table storage", 500, e?.message);
  }
};

/* ═══════════════════════════════════════════════
   4. Warehouse Load Metrics
   ═══════════════════════════════════════════════ */

/** GET /api/sf-metrics/warehouse-load */
export const getWarehouseLoad = async (req, res) => {
  const days = parseDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        WAREHOUSE_NAME,
        TO_CHAR(START_TIME, 'YYYY-MM-DD HH24:MI') AS TIME_SLOT,
        AVG_RUNNING,
        AVG_QUEUED_LOAD,
        AVG_QUEUED_PROVISIONING,
        AVG_BLOCKED
      FROM VW_WAREHOUSE_LOAD_HISTORY
      WHERE START_TIME >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
        ${whFilter(req)}
      ORDER BY START_TIME DESC
      LIMIT 500
    `);
    return ok(res, rows, "Warehouse load fetched");
  } catch (e) {
    console.error("[warehouse-load]", e?.message);
    return fail(res, "Failed to fetch warehouse load", 500, e?.message);
  }
};

/** GET /api/sf-metrics/warehouse-events */
export const getWarehouseEvents = async (req, res) => {
  const days = parseDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        WAREHOUSE_NAME,
        TO_CHAR(TIMESTAMP, 'YYYY-MM-DD HH24:MI') AS EVENT_TIME,
        EVENT_NAME,
        EVENT_REASON,
        CLUSTER_NUMBER
      FROM VW_WAREHOUSE_EVENTS_HISTORY
      WHERE TIMESTAMP >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
        ${whFilter(req)}
      ORDER BY TIMESTAMP DESC
      LIMIT 500
    `);
    return ok(res, rows, "Warehouse events fetched");
  } catch (e) {
    console.error("[warehouse-events]", e?.message);
    return fail(res, "Failed to fetch warehouse events", 500, e?.message);
  }
};

/** GET /api/sf-metrics/warehouse-status */
export const getWarehouseStatus = async (req, res) => {
  try {
    const rows = await execQuery(`SHOW WAREHOUSES`);
    return ok(res, rows, "Warehouse status fetched");
  } catch (e) {
    console.error("[warehouse-status]", e?.message);
    return fail(res, "Failed to fetch warehouse status", 500, e?.message);
  }
};

/* ═══════════════════════════════════════════════
   6. Data Pipeline Metrics
   ═══════════════════════════════════════════════ */

/** GET /api/sf-metrics/task-history */
export const getTaskHistory = async (req, res) => {
  const days = parseDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        DATABASE_NAME,
        SCHEMA_NAME,
        NAME AS TASK_NAME,
        STATE,
        TO_CHAR(SCHEDULED_TIME, 'YYYY-MM-DD HH24:MI') AS SCHEDULED_TIME,
        TO_CHAR(COMPLETED_TIME, 'YYYY-MM-DD HH24:MI') AS COMPLETED_TIME,
        RETURN_VALUE,
        ERROR_CODE,
        ERROR_MESSAGE
      FROM VW_TASK_HISTORY
      WHERE SCHEDULED_TIME >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
        ${dbFilter(req)}
      ORDER BY SCHEDULED_TIME DESC
      LIMIT 500
    `);
    return ok(res, rows, "Task history fetched");
  } catch (e) {
    console.error("[task-history]", e?.message);
    return fail(res, "Failed to fetch task history", 500, e?.message);
  }
};

/** GET /api/sf-metrics/copy-history */
export const getCopyHistory = async (req, res) => {
  const days = parseDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        TABLE_CATALOG_NAME,
        TABLE_SCHEMA_NAME,
        TABLE_NAME,
        FILE_NAME,
        TO_CHAR(LAST_LOAD_TIME, 'YYYY-MM-DD HH24:MI') AS LOAD_TIME,
        STATUS,
        ROW_COUNT,
        ROW_PARSED,
        FILE_SIZE,
        ERROR_COUNT,
        FIRST_ERROR_MESSAGE
      FROM VW_COPY_HISTORY
      WHERE LAST_LOAD_TIME >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
      ORDER BY LAST_LOAD_TIME DESC
      LIMIT 500
    `);
    return ok(res, rows, "Copy history fetched");
  } catch (e) {
    console.error("[copy-history]", e?.message);
    return fail(res, "Failed to fetch copy history", 500, e?.message);
  }
};

/* ═══════════════════════════════════════════════
   7. Database-Specific Metrics
   ═══════════════════════════════════════════════ */

/** GET /api/sf-metrics/query-type-breakdown */
export const getQueryTypeBreakdown = async (req, res) => {
  const days = safeDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        QUERY_TYPE,
        COUNT(*) AS QUERY_COUNT,
        ROUND(AVG(TOTAL_ELAPSED_TIME), 2) AS AVG_ELAPSED_MS,
        ROUND(SUM(CREDITS_USED_CLOUD_SERVICES), 4) AS TOTAL_CLOUD_CREDITS
      FROM VW_QUERY_HISTORY
      WHERE START_TIME >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
        ${dbFilter(req)}
        ${whFilter(req)}
      GROUP BY QUERY_TYPE
      ORDER BY QUERY_COUNT DESC
    `);
    return ok(res, rows, "Query type breakdown fetched");
  } catch (e) {
    console.error("[query-type-breakdown]", e?.message);
    return fail(res, "Failed to fetch query type breakdown", 500, e?.message);
  }
};

/** GET /api/sf-metrics/user-activity */
export const getUserActivity = async (req, res) => {
  const days = safeDays(req);
  try {
    const rows = await execQuery(`
      SELECT
        USER_NAME,
        COUNT(*) AS QUERY_COUNT,
        ROUND(SUM(CREDITS_USED_CLOUD_SERVICES), 4) AS TOTAL_CLOUD_CREDITS,
        ROUND(AVG(TOTAL_ELAPSED_TIME), 2) AS AVG_ELAPSED_MS,
        COUNT(CASE WHEN EXECUTION_STATUS = 'FAIL' THEN 1 END) AS FAILED_QUERIES
      FROM VW_QUERY_HISTORY
      WHERE START_TIME >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
        ${dbFilter(req)}
        ${whFilter(req)}
      GROUP BY USER_NAME
      ORDER BY QUERY_COUNT DESC
      LIMIT 20
    `);
    return ok(res, rows, "User activity fetched");
  } catch (e) {
    console.error("[user-activity]", e?.message);
    return fail(res, "Failed to fetch user activity", 500, e?.message);
  }
};

/** GET /api/sf-metrics/costliest-queries?days=30&sort=desc&limit=50&user= */
export const getCostliestQueries = async (req, res) => {
  const days = safeDays(req);
  const sort = req.query.sort === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
  const user = req.query.user || '';

  let userFilter = '';
  if (user) {
    // Sanitize: allow only alphanumeric, underscore, dot, dash
    const safeUser = user.replace(/[^a-zA-Z0-9_.\-]/g, '');
    userFilter = `AND USER_NAME = '${safeUser}'`;
  }

  try {
    const rows = await execQuery(`
      SELECT
        QUERY_ID,
        LEFT(QUERY_TEXT, 200) AS QUERY_TEXT,
        USER_NAME,
        WAREHOUSE_NAME,
        QUERY_TYPE,
        TO_CHAR(START_TIME, 'YYYY-MM-DD HH24:MI') AS START_TIME,
        ROUND(TOTAL_ELAPSED_TIME / 1000, 2) AS DURATION_SEC,
        CREDITS_USED_CLOUD_SERVICES AS CLOUD_CREDITS,
        BYTES_SCANNED,
        PARTITIONS_SCANNED,
        EXECUTION_STATUS
      FROM VW_QUERY_HISTORY
      WHERE START_TIME >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
        ${dbFilter(req)}
        ${whFilter(req)}
        AND CREDITS_USED_CLOUD_SERVICES > 0
        ${userFilter}
      ORDER BY CREDITS_USED_CLOUD_SERVICES ${sort}
      LIMIT ${limit}
    `);
    return ok(res, rows, "Costliest queries fetched");
  } catch (e) {
    console.error("[costliest-queries]", e?.message);
    return fail(res, "Failed to fetch costliest queries", 500, e?.message);
  }
};

/* ═══════════════════════════════════════════════
   Query Optimization Recommendations (LLM-powered)
   ═══════════════════════════════════════════════ */

/** POST /api/sf-metrics/query-recommendations */
export const getQueryRecommendations = async (req, res) => {
  const d = parseInt(req.body?.days || req.query.days, 10);
  const db = parseDatabase(req);
  // Cap to 7 days when no database selected to prevent timeout
  const days = (!db && d > 7) ? 7 : (d > 0 && d <= 90 ? d : 30);
  try {
    // 1. Fetch top 5 costliest queries with execution details
    const queries = await execQuery(`
      SELECT
        LEFT(QUERY_TEXT, 300) AS QUERY_TEXT,
        QUERY_TYPE,
        WAREHOUSE_NAME,
        WAREHOUSE_SIZE,
        ROUND(TOTAL_ELAPSED_TIME / 1000, 2) AS DURATION_SEC,
        CREDITS_USED_CLOUD_SERVICES AS CLOUD_CREDITS,
        BYTES_SCANNED,
        PARTITIONS_SCANNED,
        PARTITIONS_TOTAL,
        BYTES_SPILLED_TO_LOCAL_STORAGE,
        BYTES_SPILLED_TO_REMOTE_STORAGE,
        ROWS_PRODUCED,
        EXECUTION_STATUS
      FROM VW_QUERY_HISTORY
      WHERE START_TIME >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
        ${dbFilter(req)}
        AND CREDITS_USED_CLOUD_SERVICES > 0
        AND EXECUTION_STATUS = 'SUCCESS'
      ORDER BY CREDITS_USED_CLOUD_SERVICES DESC
      LIMIT 5
    `);

    if (queries.length === 0) {
      return ok(res, { recommendations: [], summary: "No queries found in the selected time range.", queriesAnalyzed: 0 });
    }

    // 2. Build a structured summary for the LLM
    const querySummaries = queries.map((q, i) => (
      `Query ${i + 1}:
  - SQL: ${q.QUERY_TEXT}
  - Type: ${q.QUERY_TYPE}
  - Warehouse: ${q.WAREHOUSE_NAME} (Size: ${q.WAREHOUSE_SIZE})
  - Duration: ${q.DURATION_SEC}s
  - Cloud Credits: ${q.CLOUD_CREDITS}
  - Bytes Scanned: ${q.BYTES_SCANNED}
  - Partitions Scanned/Total: ${q.PARTITIONS_SCANNED}/${q.PARTITIONS_TOTAL}
  - Bytes Spilled (Local): ${q.BYTES_SPILLED_TO_LOCAL_STORAGE}
  - Bytes Spilled (Remote): ${q.BYTES_SPILLED_TO_REMOTE_STORAGE}
  - Rows Produced: ${q.ROWS_PRODUCED}`
    )).join("\n\n");

    const prompt = `You are a Snowflake cost optimization expert. Analyze these top 5 costliest queries and provide actionable recommendations to reduce cost and improve efficiency.

${querySummaries}

Provide your response as valid JSON with this exact structure:
{
  "summary": "A 1-2 sentence overall assessment",
  "recommendations": [
    {
      "category": "Warehouse Sizing|Query Optimization|Clustering & Partitioning|Caching|Cost Reduction",
      "title": "Short title",
      "description": "Detailed actionable recommendation",
      "impact": "high|medium|low"
    }
  ]
}

Provide 4-6 specific, actionable recommendations. Focus on:
1. Warehouse right-sizing (over-provisioned or under-provisioned based on spill/queue data)
2. Query rewrites (unnecessary full table scans, missing filters, inefficient joins)
3. Clustering keys or materialized views to reduce partitions scanned
4. Result caching opportunities
5. Scheduling optimizations (off-peak execution)

Return ONLY the JSON, no markdown fences or extra text.`;

    const safePrompt = prompt.replace(/'/g, "''");
    const llmResult = await execQuery(
      `SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '${safePrompt}') AS RESPONSE`
    );

    const rawResponse = llmResult[0]?.RESPONSE || llmResult[0]?.[Object.keys(llmResult[0])[0]] || "{}";

    // 3. Parse the LLM JSON response
    let parsed;
    try {
      // The response might be wrapped in markdown code fences
      const cleaned = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      // If parsing fails, return raw text as a single recommendation
      parsed = {
        summary: "Analysis complete. See recommendations below.",
        recommendations: [{
          category: "General",
          title: "Optimization Suggestions",
          description: rawResponse.slice(0, 2000),
          impact: "medium"
        }]
      };
    }

    return ok(res, {
      recommendations: parsed.recommendations || [],
      summary: parsed.summary || "Analysis complete.",
      queriesAnalyzed: queries.length
    });
  } catch (e) {
    console.error("[query-recommendations]", e?.message);
    return fail(res, "Failed to generate query recommendations", 500, e?.message);
  }
};
