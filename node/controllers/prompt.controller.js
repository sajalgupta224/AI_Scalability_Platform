import { execQuery } from "../config/database.js";
import { logAuditError } from "../helpers/errorLogger.js";

// Get all prompts
export const getAllPrompts = async (req, res) => {
  try {
    const query = "SELECT * FROM R_PROMPTS_TBL";
    const rows = await execQuery(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching prompts:", err.message);
     logAuditError({
      eventType: 'ERROR',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch prompts",
      message: err.message
    });
  }
};

// Get prompt by ID
export const getPromptById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = "SELECT * FROM R_PROMPTS_TBL WHERE PROMPT_ID = ?";
    const rows = await execQuery(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Prompt not found"
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error fetching prompt by ID:", err.message);
     logAuditError({
      eventType: 'ERROR',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch prompt",
      message: err.message
    });
  }
};
