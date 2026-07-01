import { execQuery } from "../config/database.js";
import { logAuditError } from "../helpers/errorLogger.js";

// Get all pipelines
export const getAllPipelines = async (req, res) => {
  try {
    const query = "SELECT * FROM R_PIPELINE_METADATA_TBL";
    const rows = await execQuery(query);
    res.json({ message: "hello", success: true, data: rows });
  } catch (err) {
    console.error("Error fetching pipelines:", err.message);
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
      error: "Failed to fetch pipelines",
      message: err.message
    });
  }
};

// Get pipeline by ID
export const getPipelineById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = "SELECT * FROM R_PIPELINE_METADATA_TBL WHERE PIPELINE_ID = ?";
    const rows = await execQuery(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Pipeline not found"
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error fetching pipeline by ID:", err.message);
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
      error: "Failed to fetch pipeline",
      message: err.message
    });
  }
};