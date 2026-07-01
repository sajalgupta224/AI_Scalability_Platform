import path from "path";
import fs from "fs";
import os from "os";
import multer from "multer";
import connection, { execQuery } from "../config/database.js";
import { logAuditError } from "../helpers/errorLogger.js";

const STAGE_NAME = "service_stage";

// Multer setup: accept only .sql, up to 5MB, store in OS temp dir
export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!/\.sql$/i.test(file.originalname)) return cb(new Error("Only .sql files are allowed"));
    cb(null, true);
  },
});

function toSnowflakeFileUri(absPath) {
  return process.platform === "win32" ? `file://${absPath.replace(/\\/g, "/")}` : `file://${absPath}`;
}

function quoteIfNeeded(uri) {
  return /[\s$]/.test(uri) ? `'${uri}'` : uri;
}

export const healthCheck = async (req, res) => {
  try {
    res.json({
      status: "ok",
      snowflake_connected: connection.isUp && connection.isUp(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// FETCH SERVICES
export const getServices = async (req, res) => {
  try {
    const rows = await execQuery("CALL R_sp_fetch_services()");
    res.json(rows || []);
  } catch (err) {
    logAuditError({
      eventType: 'ERROR',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    console.error("Fetch services failed:", err.message);
    res.status(500).json({ error: "Error fetching services", details: err.message });
  }
};


export const getCombinedServices = async (req, res) => {
  try {
    console.log("🚀 [GET] /services/combined hit");

    // 1) OLD fetch SP (basic fields)
    // Must return: SERVICE_ID, SERVICE_NAME, OBJECT_TYPE, OBJECT_NAME, DESCRIPPTION, TEMPLATE_ID, USER_ID, CREATED_AT, etc.
    const basicRows = await execQuery("CALL R_sp_fetch_services()");

    // 2) Direct SELECT for the extra fields (no new SP)
    // Must return: SERVICE_ID, INPUT_AGR, OUTPUT_AGR, SCRIPT_STAGE_PATH
    const argRows = await execQuery(`
      SELECT
        SERVICE_ID,
        INPUT_AGR,
        OUTPUT_AGR,
        SCRIPT_STAGE_PATH
      FROM R_SERVICES_TBL
    `);

    // 3) Index the extra fields by SERVICE_ID
    const argMap = {};
    for (const r of argRows || []) {
      argMap[r.SERVICE_ID] = r;
    }

    // 4) Merge: prefer values from basicRows, overlay with INPUT/OUTPUT/SCRIPT from argMap
    const merged = (basicRows || []).map((row) => {
      const extra = argMap[row.SERVICE_ID] || {};
      return {
        ...row,
        INPUT_AGR: extra.INPUT_AGR ?? null,
        OUTPUT_AGR: extra.OUTPUT_AGR ?? null,
        SCRIPT_STAGE_PATH: extra.SCRIPT_STAGE_PATH ?? null,
      };
    });

    return res.json(merged);
  } catch (err) {
    console.error("Combined fetch error:", err?.message || err);
    logAuditError({
      eventType: 'ERROR',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    return res.status(500).json({
      error: "Error fetching combined services",
      details: err?.message || String(err),
    });
  }
};

// UPLOAD-ONLY ENDPOINT
export const uploadOnly = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const localPath = path.resolve(req.file.path);
  const fileUri = toSnowflakeFileUri(localPath);
  const targetName = req.file.originalname;

  const putQuery = `PUT ${quoteIfNeeded(fileUri)} @${STAGE_NAME}/${targetName} AUTO_COMPRESS=FALSE OVERWRITE=TRUE`;

  connection.execute({
    sqlText: putQuery,
    complete: (err, stmt, rows) => {
      fs.rm(localPath, { force: true }, () => { });
      if (err) {
        console.error("PUT failed:", err.message);
        logAuditError({
          eventType: 'ERROR',
          errorMessage: err.message || String(err),
          context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
          logDesc: 'Failure in ' + req.originalUrl,
          userId: req.headers['x-user-id'] || 'unknown',
          querId: err.statementId || 'UNKNOWN'
        });
        return res.status(500).json({ error: "Upload failed", details: err.message });
      }
      res.json({ uploaded: true, stage_path: `${STAGE_NAME}/${targetName}`, result: rows });
    },
  });
};

// REGISTER SERVICE
export const registerService = async (req, res) => {
  try {
    const { service_name, object_type, object_name, description, template_id, user_id, input_agr, output_agr } = req.body;

    if (!service_name || !object_type || !object_name) {
      return res.status(400).json({ error: "service_name, object_type, object_name are required" });
    }

    if (!req.file) return res.status(400).json({ error: "Script file is required" });

    const localPath = path.resolve(req.file.path);
    const fileUri = toSnowflakeFileUri(localPath);
    const targetName = req.file.originalname;
    const stagePath = `${STAGE_NAME}/${targetName}`;

    const putQuery = `PUT ${quoteIfNeeded(fileUri)} @${stagePath} AUTO_COMPRESS=FALSE OVERWRITE=TRUE`;

    // 1) PUT FILE TO STAGE
    connection.execute({
      sqlText: putQuery,
      complete: async (err) => {
        fs.rm(localPath, { force: true }, () => { });

        if (err) {
          console.error("PUT failed:", err.message);
           logAuditError({
      eventType: 'ERROR',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
          return res.status(500).json({ error: "Upload failed", details: err.message });
        }

        // 2) SAVE IN DB USING YOUR SP
        const saveQuery = `CALL R_sp_save_service(?, ?, ?, ?, ?, ?)`;
        const bindParams = [
          service_name,
          object_type,
          object_name,
          description || "",
          Number(template_id ?? 1),
          user_id != null ? Number(user_id) : null,
        ];

        try {
          const result = await execQuery(saveQuery, bindParams);

          const firstRow = result && result[0] ? result[0] : {};
          const serviceId =
            firstRow.R_SP_SAVE_SERVICE ||
            firstRow["R_SP_SAVE_SERVICE"] ||
            Object.values(firstRow)[0];

          if (!serviceId) {
            return res.status(500).json({
              error: "Failed to get service_id after saving",
            });
          }

          console.log("Service ID returned:", serviceId);

          // 3) UPDATE SCRIPT PATH
          const updateSql = `
            UPDATE R_SERVICES_TBL
            SET
              SCRIPT_STAGE_PATH = ?,
              INPUT_AGR = ?,
              OUTPUT_AGR = ?
            WHERE SERVICE_ID = ?
          `;

          console.log("Updating SCRIPT_STAGE_PATH:", stagePath);

          await execQuery(updateSql, [stagePath, input_agr || null, output_agr || null, Number(serviceId)]);

          return res.json({
            ok: true,
            service_id: serviceId,
            staged_file: stagePath,
            message: "Service registered successfully",
          });
        } catch (err2) {
           logAuditError({
      eventType: 'ERROR',
      errorMessage: err2.message || String(err2),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err2.statementId || 'UNKNOWN'
    });
          console.error("Error during registerService:", err2.message);
          return res.status(500).json({ error: "Registration failed", details: err2.message });
        }
      },
    });
  } catch (err) {
    console.error("registerService error:", err.message);
    res.status(500).json({ error: "Registration error", details: err.message });
  }
};

// DEPLOY SERVICE
export const deployService = async (req, res) => {
  try {
    const { service_id } = req.body;

    if (!service_id) return res.status(400).json({ error: "service_id is required" });

    const sql = `
      SELECT SERVICE_ID, SERVICE_NAME, OBJECT_TYPE, OBJECT_NAME, SCRIPT_STAGE_PATH
      FROM R_SERVICES_TBL
      WHERE SERVICE_ID = ?
      LIMIT 1
    `;

    const rows = await execQuery(sql, [Number(service_id)]);

    if (!rows || !rows[0]) {
      return res.status(404).json({ error: "Service not found" });
    }

    let { SERVICE_NAME, OBJECT_TYPE, OBJECT_NAME, SCRIPT_STAGE_PATH } = rows[0];

    if (!SCRIPT_STAGE_PATH) {
      return res.status(400).json({ error: "SCRIPT_STAGE_PATH is empty for this service" });
    }

    SCRIPT_STAGE_PATH = SCRIPT_STAGE_PATH.trim();
    const normalizedPath = SCRIPT_STAGE_PATH.startsWith("@")
      ? SCRIPT_STAGE_PATH.slice(1)
      : SCRIPT_STAGE_PATH;

    const execSql = `EXECUTE IMMEDIATE FROM @${normalizedPath}`;
    const result = await execQuery(execSql);

    return res.json({
      deployed: true,
      service_id,
      service_name: SERVICE_NAME,
      object_type: OBJECT_TYPE,
      object_name: OBJECT_NAME,
      stage_file: normalizedPath,
      result,
      message: "Deployment executed successfully",
    });
  } catch (err) {
     logAuditError({
      eventType: 'ERROR',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    console.error("deployService error:", err.message);
    return res.status(500).json({ error: "Deployment failed", details: err.Message });
  }
};