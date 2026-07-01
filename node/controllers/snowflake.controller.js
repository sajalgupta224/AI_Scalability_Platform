import { execQuery } from "../config/database.js";
import { logAuditError } from "../helpers/errorLogger.js";

// Get Snowflake roles
export const getRoles = async (req, res) => {
  try {
    const query = "SELECT DISTINCT role FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS";
    const rows = await execQuery(query);
    res.json({ success: true, data: rows });
  } catch (err) {
     logAuditError({
      eventType: 'ERROR',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    console.error("Error fetching Snowflake roles:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch Snowflake roles",
      message: err.message
    });
  }
};

// Get Snowflake current user
export const getCurrentUser = async (req, res) => {
  try {
    const query = `SELECT
                        u.user_id AS userId,
                        u.name AS userName,
                        u.login_name AS loginName,
                        u.email as email
                    FROM snowflake.account_usage.users u
                    WHERE u.name = CURRENT_USER();`
    // const query = "SELECT CURRENT_USER() AS CURRENT_USER";
    const rows = await execQuery(query);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "DB user not found"
      });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
     logAuditError({
      eventType: 'ERROR',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    console.error("Error fetching Snowflake current user:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch Snowflake current user",
      message: err.message
    });
  }
};

// Get container services history with filters
export const getContainerServicesHistory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT
        APPLICATION_NAME,
        COMPUTE_POOL_NAME,
        START_TIME,
        SUM(CREDITS_USED) AS COMPUTE_CREDITS,
        SUM(CREDITS_USED) * 2 AS ESTIMATED_COST
      FROM SNOWFLAKE.ACCOUNT_USAGE.SNOWPARK_CONTAINER_SERVICES_HISTORY
      WHERE 1=1
    `;

    const binds = [];

    if (startDate) {
      query += " AND START_TIME >= ?";
      binds.push(startDate);
    }

    if (endDate) {
      query += " AND START_TIME <= ?";
      binds.push(endDate);
    }

    query += " GROUP BY APPLICATION_NAME, COMPUTE_POOL_NAME, START_TIME ORDER BY START_TIME;";

    const rows = await execQuery(query, binds);
    res.json({ success: true, data: rows });
  } catch (err) {
     logAuditError({
      eventType: 'ERROR',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    console.error("Error fetching container services history:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch container services history",
      message: err.message
    });
  }
};
