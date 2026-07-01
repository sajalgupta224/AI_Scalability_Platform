import express from "express";
import {
  getServices,
  uploadOnly,
  registerService,
  upload,
  healthCheck,
  getCombinedServices,
} from "../controllers/services.controller.js";

const router = express.Router();

// Router routes (designed to be mounted by the main server)
router.get("/health", healthCheck);
router.get("/", getServices);
router.get("/combined", getCombinedServices);
router.post("/upload", upload.single("file"), uploadOnly);
router.post("/", upload.single("file"), registerService);
router.post("/deploy", async (req, res) => {
  try {
    const { service_id } = req.body;
    if (!service_id) {
      return res.status(400).json({ error: "service_id is required" });
    }
    // 1) Fetch service record
    const fetchSql = `
      SELECT SERVICE_ID, SERVICE_NAME, OBJECT_TYPE, OBJECT_NAME, SCRIPT_STAGE_PATH
      FROM R_SERVICES_TBL
      WHERE SERVICE_ID = ?
      LIMIT 1
    `;
    const { execQuery } = await import("../config/database.js");
    const rows = await execQuery(fetchSql, [Number(service_id)]);
    if (!rows || !rows[0]) {
      return res.status(404).json({ error: "Service not found" });
    }
    const { SERVICE_NAME, OBJECT_TYPE, OBJECT_NAME } = rows[0];
    let { SCRIPT_STAGE_PATH } = rows[0];
    if (!SCRIPT_STAGE_PATH || String(SCRIPT_STAGE_PATH).trim() === "") {
      return res.status(400).json({ error: "SCRIPT_STAGE_PATH is empty for this service" });
    }
    SCRIPT_STAGE_PATH = String(SCRIPT_STAGE_PATH).trim();
    const normalizedPath = SCRIPT_STAGE_PATH.startsWith("@")
      ? SCRIPT_STAGE_PATH.slice(1)
      : SCRIPT_STAGE_PATH;
    if (!/^[\w.\-/"/]+$/.test(normalizedPath)) {
      return res.status(400).json({ error: "SCRIPT_STAGE_PATH contains invalid characters" });
    }
    const execSql = `EXECUTE IMMEDIATE FROM @${normalizedPath}`;
    const deployResult = await execQuery(execSql);
    return res.json({
      deployed: true,
      service_id: Number(service_id),
      service_name: SERVICE_NAME,
      object_type: OBJECT_TYPE,
      object_name: OBJECT_NAME,
      stage_file: normalizedPath,
      result: deployResult,
      message: "Deployment executed successfully",
    });
  } catch (err) {
    console.error("deployService error:", err.message);
    return res.status(500).json({
      error: "Deployment failed",
      details: err.message,
    });
  }
});

export default router;
// --- Snowflake connection ---
