import express from "express";
import crypto from "crypto";
import axios from "axios";
import https from "https";
import { execQuery } from "../config/database.js";
import { logAuditError } from "../helpers/errorLogger.js";

const router = express.Router();

const HOST = process.env.SNOWFLAKE_HOST || "PIHJDMO-SFCOCOHOL.snowflakecomputing.com";
const AUTH_TOKEN = process.env.SNOWFLAKE_AUTH_TOKEN;

router.post("/register", async (req, res) => {
  try {
    const {
      sourceNamespace,
      sourceName,
      sourceType,
      targetDatabase,
      targetSchema,
      targetTable,
      description,
      pushToSnowflake = false,
    } = req.body;

    if (!sourceNamespace || !sourceName || !sourceType || !targetDatabase || !targetSchema || !targetTable) {
      return res.status(400).json({
        error: "sourceNamespace, sourceName, sourceType, targetDatabase, targetSchema, targetTable are required",
      });
    }

    const createdBy = req.headers["x-user-id"] || "unknown";

    const insertSql = `
      INSERT INTO D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_EXTERNAL_LINEAGE_SOURCES
        (SOURCE_NAMESPACE, SOURCE_NAME, SOURCE_TYPE, TARGET_DATABASE, TARGET_SCHEMA, TARGET_TABLE, DESCRIPTION, CREATED_BY)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await execQuery(insertSql, [
      sourceNamespace,
      sourceName,
      sourceType.toUpperCase(),
      targetDatabase.toUpperCase(),
      targetSchema.toUpperCase(),
      targetTable.toUpperCase(),
      description || null,
      createdBy,
    ]);

    let externalLineageResult = null;
    if (pushToSnowflake && AUTH_TOKEN) {
      const payload = {
        eventType: "COMPLETE",
        eventTime: new Date().toISOString(),
        job: { namespace: "RAISE_PLATFORM", name: `ingest_${sourceType}_${sourceName}` },
        run: { runId: crypto.randomUUID() },
        producer: "https://raise-platform/lineage-ingester/v1",
        schemaURL: "https://openlineage.io/spec/0-0-1/OpenLineage.json",
        inputs: [
          {
            namespace: sourceNamespace,
            name: sourceName,
            facets: { datasetType: { datasetType: sourceType.toUpperCase() } },
          },
        ],
        outputs: [
          {
            namespace: `snowflake://${HOST.replace(".snowflakecomputing.com", "")}`,
            name: `${targetDatabase}.${targetSchema}.${targetTable}`,
          },
        ],
      };

      try {
        const httpsAgent = new https.Agent({ rejectUnauthorized: false });
        const response = await axios.post(
          `https://${HOST}/api/v2/lineage/external-lineage`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${AUTH_TOKEN}`,
              "Content-Type": "application/json",
            },
            httpsAgent,
            timeout: 15000,
          }
        );
        externalLineageResult = { status: response.status, pushed: true };
      } catch (apiErr) {
        externalLineageResult = {
          pushed: false,
          error: apiErr?.response?.status || apiErr.message,
          note: "Saved locally but failed to push to Snowflake External Lineage API",
        };
      }
    }

    return res.json({
      ok: true,
      message: "External lineage source registered successfully",
      externalLineageResult,
    });
  } catch (err) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    console.error("External lineage register error:", err.message);
    return res.status(500).json({ error: "Failed to register external lineage", details: err.message });
  }
});

router.get("/sources", async (req, res) => {
  try {
    const { targetDatabase, targetSchema, targetTable } = req.query;

    let sql = `SELECT * FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_EXTERNAL_LINEAGE_SOURCES WHERE IS_ACTIVE = TRUE`;
    const binds = [];

    if (targetDatabase) {
      sql += " AND TARGET_DATABASE = ?";
      binds.push(targetDatabase.toUpperCase());
    }
    if (targetSchema) {
      sql += " AND TARGET_SCHEMA = ?";
      binds.push(targetSchema.toUpperCase());
    }
    if (targetTable) {
      sql += " AND TARGET_TABLE = ?";
      binds.push(targetTable.toUpperCase());
    }

    sql += " ORDER BY CREATED_AT DESC";

    const rows = await execQuery(sql, binds);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error("External lineage sources error:", err.message);
    return res.status(500).json({ error: "Failed to fetch external lineage sources", details: err.message });
  }
});

router.delete("/sources/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await execQuery(
      `UPDATE D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_EXTERNAL_LINEAGE_SOURCES SET IS_ACTIVE = FALSE WHERE SOURCE_ID = ?`,
      [Number(id)]
    );
    return res.json({ ok: true, message: "External source deactivated" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete", details: err.message });
  }
});

router.post("/for-nodes", async (req, res) => {
  try {
    const { nodeIds } = req.body;
    if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      return res.json({ data: [] });
    }

    const placeholders = nodeIds.map(() => "?").join(",");
    const sql = `
      SELECT *
      FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_EXTERNAL_LINEAGE_SOURCES
      WHERE IS_ACTIVE = TRUE
        AND (TARGET_DATABASE || '.' || TARGET_SCHEMA || '.' || TARGET_TABLE) IN (${placeholders})
    `;

    const rows = await execQuery(sql, nodeIds.map((id) => id.toUpperCase()));
    return res.json({ data: rows || [] });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch external sources for nodes", details: err.message });
  }
});

export default router;
