
import connection, { execQuery } from "../config/database.js";
import { logAuditError } from "../helpers/errorLogger.js";

// GET /api/templates
export const getTemplates = async (req, res) => {
  try {
    const query = `
      SELECT template_name as TEMPLATE_NAME, description as DESCRIPTION
      FROM R_Template_tbl
      ORDER BY created_at DESC
    `;

    const rows = await execQuery(query);

    const templates = (rows || []).map((r) => ({
      template_name: r.TEMPLATE_NAME,
      description: r.DESCRIPTION,
    }));

    // ✅ IMPORTANT: Wrap response for apiClient
    return res.json({
      success: true,
      data: templates,
    });
  } catch (err) {
     logAuditError({
      eventType: 'TEMPLATE_LOAD',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    console.error("Fetch templates failed:", err.message);
    return res.status(500).json({
      success: false,
      message: "Error fetching templates",
      error: err.message,
    });
  }
};

// POST /api/templates
export const registerTemplate = async (req, res) => {
  try {
    const { template_name, description } = req.body || {};

    if (!template_name || !description) {
      return res.status(400).json({
        success: false,
        message: "template_name and description are required",
      });
    }

    const insertSql = `
      INSERT INTO R_Template_tbl (template_name, description, created_at)
      VALUES (?, ?, CURRENT_TIMESTAMP())
    `;

    connection.execute({
      sqlText: insertSql,
      binds: [template_name, description],
      complete: (insertErr) => {
        if (insertErr) {
          console.error("Insert failed:", insertErr.message);
          return res.status(500).json({
            success: false,
            message: "Error registering template",
            error: insertErr.message,
          });
        }

        // ✅ IMPORTANT: Wrap response for apiClient
        return res.status(201).json({
          success: true,
          data: { template_name, description },
          message: "Template registered successfully",
        });
      },
    });
  } catch (err) {
    console.error("registerTemplate error:", err.message);
     logAuditError({
      eventType: 'ERROR',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    return res.status(500).json({
      success: false,
      message: "Registration error",
      error: err.message,
    });
  }
};
