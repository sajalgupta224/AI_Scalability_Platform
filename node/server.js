// const express = require("express");
// const cors = require("cors");
// const dotenv = require("dotenv");
// const snowflake = require("snowflake-sdk");
// const axios=require('axios')
// const https = require('https');
/* eslint-disable no-console */
import express from "express";
import cors from "cors";
// import morgan from "morgan";
import dotenv from "dotenv";
import snowflake from "snowflake-sdk";
import axios from "axios";
import https from "https";
import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { fileURLToPath } from "url";
import chatbotRoutes from "./routes/chatbot.routes.js";
import pipelineRoutes from "./routes/pipeline.routes.js";
import promptRoutes from "./routes/prompt.routes.js";
import snowflakeRoutes from "./routes/snowflake.routes.js";
import servicesRoutes from "./routes/services.routes.js";
import snowflakeMetaRoutes from "./routes/snowflakeMeta.routes.js";
import templatesRouter from "./routes/templates.routes.js";
import apiRoutes from "./routes/apiRoutes.js";
import settingsRoutes from "./routes/settings.routes.js";
import semanticRoutes from "./routes/SemanticView.routes.js";
import snowflakeMetricsRoutes from "./routes/snowflakeMetrics.routes.js";
import lineageAIRoutes from "./routes/lineageAI.routes.js";
import externalLineageRoutes from "./routes/externalLineage.routes.js";
import impactAnalysisRoutes from "./routes/impactAnalysis.routes.js";
import piiScannerRoutes from "./routes/piiScanner.routes.js";
import connection from "./config/database.js";
import { logAuditError } from "./helpers/errorLogger.js";

import crypto from "crypto";
import multer from "multer";
import mammoth from "mammoth";
import os from "os";

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const uploadTmpDir = path.join(os.tmpdir(), "upload-documents");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Mount the routes
app.use("/chatbots", chatbotRoutes);
app.use("/pipelines", pipelineRoutes);
app.use("/prompts", promptRoutes);
app.use("/snowflake", snowflakeRoutes);

app.use("/api", snowflakeMetaRoutes);
app.use("/api/semantic", semanticRoutes);
app.use("/api/templates", templatesRouter);
app.use("/api", apiRoutes);
// app.use(morgan("dev"));

app.use("/api/sf-metrics", snowflakeMetricsRoutes);
app.use("/api/lineage-ai", lineageAIRoutes);
app.use("/api/external-lineage", externalLineageRoutes);
app.use("/api/impact", impactAnalysisRoutes);
app.use("/api/pii", piiScannerRoutes);
app.use("/services", servicesRoutes); // or '/services'
app.get("/health", (req, res) => {
  res.json({ status: "services routes healthy2" });
});

// test commit

/**
 * DEPLOY API directly in server.js (no controller)
 * - Reads R_SERVICES_TBL for SCRIPT_STAGE_PATH
 * - Executes the SQL using: EXECUTE IMMEDIATE FROM @<stage>/<file.sql>
 * - Returns result payload
 */
// app.post("/api/services/deploy", async (req, res) => {
//   try {
//     const { service_id } = req.body;

//     if (!service_id) {
//       return res.status(400).json({ error: "service_id is required" });
//     }

//     // 1) Fetch service record
//     const fetchSql = `
//       SELECT SERVICE_ID, SERVICE_NAME, OBJECT_TYPE, OBJECT_NAME, SCRIPT_STAGE_PATH
//       FROM R_SERVICES_TBL
//       WHERE SERVICE_ID = ?
//       LIMIT 1
//     `;
//     const rows = await execQuery(fetchSql, [Number(service_id)]);

//     if (!rows || !rows[0]) {
//       return res.status(404).json({ error: "Service not found" });
//     }

//     const { SERVICE_NAME, OBJECT_TYPE, OBJECT_NAME } = rows[0];
//     let { SCRIPT_STAGE_PATH } = rows[0];

//     if (!SCRIPT_STAGE_PATH || String(SCRIPT_STAGE_PATH).trim() === "") {
//       return res.status(400).json({ error: "SCRIPT_STAGE_PATH is empty for this service" });
//     }

//     // 2) Normalize & validate stage path
//     SCRIPT_STAGE_PATH = String(SCRIPT_STAGE_PATH).trim();
//     const normalizedPath = SCRIPT_STAGE_PATH.startsWith("@")
//       ? SCRIPT_STAGE_PATH.slice(1)
//       : SCRIPT_STAGE_PATH;

//     // Strict allowlist for safety (stage and path chars)
//     if (!/^[\w.\-/"\/]+$/.test(normalizedPath)) {
//       return res.status(400).json({ error: "SCRIPT_STAGE_PATH contains invalid characters" });
//     }

//     // 3) Execute the SQL script from stage
//     const execSql = `EXECUTE IMMEDIATE FROM @${normalizedPath}`;
//     const deployResult = await execQuery(execSql);

//     // 4) Response
//     return res.json({
//       deployed: true,
//       service_id: Number(service_id),
//       service_name: SERVICE_NAME,
//       object_type: OBJECT_TYPE,
//       object_name: OBJECT_NAME,
//       stage_file: normalizedPath,
//       result: deployResult, // this is whatever the Snowflake driver returns
//       message: "Deployment executed successfully",
//     });
//   } catch (err) {
//     console.error("deployService error:", err.message);
//     return res.status(500).json({
//       error: "Deployment failed",
//       details: err.message,
//     });
//   }
// });

// --- Diagnostic route to verify binds work with the Node driver ---
// app.post("/api/services/deploy", async (req, res) => {
//   try {
//     const { service_id } = req.body;
//     console.log("Received service_id:", service_id, "Type:", typeof service_id);

//     // Strict validation for service_id
//     if (
//       service_id === undefined ||
//       service_id === null ||
//       service_id === "" ||
//       isNaN(Number(service_id))
//     ) {
//       return res.status(400).json({ error: "Valid numeric service_id is required" });
//     }

//     // 1) Fetch service record
//     const fetchSql = `
//       SELECT SERVICE_ID, SERVICE_NAME, OBJECT_TYPE, OBJECT_NAME, SCRIPT_STAGE_PATH
//       FROM R_SERVICES_TBL
//       WHERE SERVICE_ID = ?
//       LIMIT 1
//     `;
//     const rows = await execQuery(fetchSql, [Number(service_id)]);

//     if (!rows || !rows[0]) {
//       return res.status(404).json({ error: "Service not found" });
//     }

//     const { SERVICE_NAME, OBJECT_TYPE, OBJECT_NAME } = rows[0];
//     let { SCRIPT_STAGE_PATH } = rows[0];

//     if (!SCRIPT_STAGE_PATH || String(SCRIPT_STAGE_PATH).trim() === "") {
//       return res.status(400).json({ error: "SCRIPT_STAGE_PATH is empty for this service" });
//     }

//     // 2) Normalize & validate stage path
//     SCRIPT_STAGE_PATH = String(SCRIPT_STAGE_PATH).trim();
//     const normalizedPath = SCRIPT_STAGE_PATH.startsWith("@")
//       ? SCRIPT_STAGE_PATH.slice(1)
//       : SCRIPT_STAGE_PATH;

//     // Strict allowlist for safety (stage and path chars)
//     if (!/^[\w.\-/"\/]+$/.test(normalizedPath)) {
//       return res.status(400).json({ error: "SCRIPT_STAGE_PATH contains invalid characters" });
//     }

//     // 3) Execute the SQL script from stage
//     const execSql = `EXECUTE IMMEDIATE FROM @${normalizedPath}`;
//     const deployResult = await execQuery(execSql);

//     // 4) Response
//     return res.json({
//       deployed: true,
//       service_id: Number(service_id),
//       service_name: SERVICE_NAME,
//       object_type: OBJECT_TYPE,
//       object_name: OBJECT_NAME,
//       stage_file: normalizedPath,
//       result: deployResult,
//       message: "Deployment executed successfully",
//     });
//   } catch (err) {
//     console.error("deployService error:", err && err.message ? err.message : err);
//     return res.status(500).json({
//       error: "Deployment failed",
//       details: err && err.message ? err.message : String(err),
//     });
//   }
// });

app.post("/api/services/deploy", async (req, res) => {
  try {
    const { service_ids } = req.body;

    // Validate array or single value
    if (!service_ids) {
      return res.status(400).json({ message: "service_ids is required" });
    }

    // Convert single ID to array
    let ids = Array.isArray(service_ids) ? service_ids : [service_ids];

    // Ensure correct DB & schema
    await execQuery(`USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY`);
    await execQuery(`USE SCHEMA AI_SCALABILITY_SCHEMA`);

    let messages = [];

    for (const id of ids) {
      const sql = `
        SELECT SERVICE_NAME
        FROM R_SERVICES_TBL
        WHERE SERVICE_ID = ${Number(id)}
        LIMIT 1
      `;

      const rows = await execQuery(sql);

      if (rows && rows[0] && rows[0].SERVICE_NAME) {
        const name = rows[0].SERVICE_NAME;
        messages.push(`${name} is deployed successfully`);
      } else {
        messages.push(`Service ${id} not found`);
      }
    }

    return res.json({ messages });
  } catch (err) {
    console.error("DEPLOY ERROR:", err);
    logAuditError({
      eventType: "PROCESS_EXECUTION",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    return res.status(500).json({ message: "Deployment failed" });
  }
});

app.get("/diag/binds", async (_req, res) => {
  try {
    // 5 placeholders + 5 bound values
    const rows = await execQuery("select ?, ?, ?, ?, ? as COL5", [
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    res.json({ ok: true, rows });
  } catch (e) {
    console.error("Diag binds failed:", e);
    logAuditError({
      eventType: "ERROR",
      errorMessage: e.message || String(e),
      context: JSON.stringify({
        endpoint: _req.originalUrl,
        method: _req.method,
      }),
      logDesc: "Failure in " + _req.originalUrl,
      userId: _req.headers["x-user-id"] || "unknown",
      querId: e.statementId || "UNKNOWN",
    });
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

/**
 * GET /lineage
 * Required query params:
 *  - db, schema, objectName
 * Optional query params:
 *  - objectType (TABLE|VIEW|COLUMN|STAGE) default: TABLE
 *  - direction (UPSTREAM|DOWNSTREAM|BOTH) default: BOTH
 *  - maxDepth (number)
 */


// Helper: call the lineage stored procedure for a single direction
function callLineageProc(
  db,
  schema,
  objectName,
  objectType,
  columnName,
  includeColumn,
  direction,
  distance,
) {
  const proc = `"D_IN_CAPG_POC_AI_SCALABILITY"."AI_SCALABILITY_SCHEMA"."GET_FULL_LINEAGE_JSON"`;
  const sql = `CALL ${proc}(?, ?, ?, ?, ?, ?, ?, ?)`;
  const binds = [
    db,
    schema,
    objectName,
    objectType,
    includeColumn ? columnName : null,
    includeColumn ? true : false,
    direction,
    distance,
  ];
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sql,
      binds,
      complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows)),
    });
  });
}

// Helper: parse stored procedure result rows into a payload object
function parseLineageResult(rows) {
  const first = rows?.[0];
  const key = first ? Object.keys(first)[0] : null;
  let payload = first[key];
  if (Buffer.isBuffer(payload)) payload = payload.toString("utf8");
  if (typeof payload === "string") payload = JSON.parse(payload);
  return payload;
}

// Helper: merge two lineage payloads (upstream + downstream) into one
function mergeLineagePayloads(upPayload, downPayload) {
  // Merge object_lineage nodes by id
  const objNodeMap = new Map();
  for (const n of upPayload.object_lineage?.nodes || []) {
    objNodeMap.set(n.id, n);
  }
  for (const n of downPayload.object_lineage?.nodes || []) {
    if (!objNodeMap.has(n.id)) objNodeMap.set(n.id, n);
  }

  // Merge object_lineage edges by id
  const objEdgeMap = new Map();
  for (const e of upPayload.object_lineage?.edges || []) {
    objEdgeMap.set(e.id, e);
  }
  for (const e of downPayload.object_lineage?.edges || []) {
    if (!objEdgeMap.has(e.id)) objEdgeMap.set(e.id, e);
  }

  // Merge column_lineage nodes by id
  const colNodeMap = new Map();
  for (const n of upPayload.column_lineage?.nodes || []) {
    colNodeMap.set(n.id, n);
  }
  for (const n of downPayload.column_lineage?.nodes || []) {
    if (!colNodeMap.has(n.id)) colNodeMap.set(n.id, n);
  }

  // Merge column_lineage edges (stored as object keyed by edge id)
  const upColEdges = upPayload.column_lineage?.edges || {};
  const downColEdges = downPayload.column_lineage?.edges || {};
  const mergedColEdges = { ...upColEdges, ...downColEdges };

  // Use upstream meta as base, override direction to BOTH
  const meta = {
    ...(upPayload.meta || downPayload.meta || {}),
    direction: "BOTH",
  };

  return {
    object_lineage: {
      nodes: Array.from(objNodeMap.values()),
      edges: Array.from(objEdgeMap.values()),
    },
    column_lineage: {
      nodes: Array.from(colNodeMap.values()),
      edges: mergedColEdges,
    },
    meta,
  };
}

// Helper: recursively chain GET_LINEAGE calls to go beyond distance 5
async function fetchRecursiveLineage(
  db,
  schema,
  objectName,
  objectType,
  columnName,
  includeColumn,
  direction,
  totalDistance,
) {
  const MAX_PER_CALL = 5;
  const MAX_ITERATIONS = 5; // safety cap: max 5 rounds = depth 25

  // First call from root
  const firstDistance = Math.min(totalDistance, MAX_PER_CALL);
  const rows = await callLineageProc(
    db,
    schema,
    objectName,
    objectType,
    columnName,
    includeColumn,
    direction,
    String(firstDistance),
  );
  let payload = parseLineageResult(rows);

  if (totalDistance <= MAX_PER_CALL) return payload;

  // Accumulate all nodes and edges across iterations
  const allObjNodes = new Map();
  const allObjEdges = new Map();
  const allColNodes = new Map();
  const allColEdges = {};

  // Seed with first result
  for (const n of payload.object_lineage?.nodes || []) {
    allObjNodes.set(n.id, n);
  }
  for (const e of payload.object_lineage?.edges || []) {
    const eid = e.id || `${e.source}__${e.target}`;
    allObjEdges.set(eid, e);
  }
  for (const n of payload.column_lineage?.nodes || []) {
    allColNodes.set(n.id, n);
  }
  const colEdges = payload.column_lineage?.edges || {};
  Object.assign(allColEdges, colEdges);

  const visited = new Set(allObjNodes.keys());
  let remainingDistance = totalDistance - MAX_PER_CALL;
  let iteration = 0;

  // Find frontier: nodes at max distance in current result
  let frontier = (payload.object_lineage?.nodes || []).filter(
    (n) => Number(n.distance) === MAX_PER_CALL,
  );

  while (
    frontier.length > 0 &&
    remainingDistance > 0 &&
    iteration < MAX_ITERATIONS
  ) {
    iteration++;
    const callDistance = Math.min(remainingDistance, MAX_PER_CALL);
    const distanceOffset = totalDistance - remainingDistance;

    // Call GET_LINEAGE from each frontier node in parallel
    const frontierCalls = frontier.map(async (frontierNode) => {
      // Parse FQN: "DB.SCHEMA.OBJECT_NAME"
      const parts = (frontierNode.id || "").split(".");
      if (parts.length < 3) return null;
      const fDb = parts[0];
      const fSchema = parts[1];
      const fName = parts.slice(2).join("."); // handle names with dots

      try {
        const fRows = await callLineageProc(
          fDb,
          fSchema,
          fName,
          objectType,
          null,
          false,
          direction,
          String(callDistance),
        );
        return parseLineageResult(fRows);
      } catch (err) {
        // Skip nodes that fail (might be inaccessible)
        console.warn(
          `Recursive lineage: skipping ${frontierNode.id}: ${err.message}`,
        );
        return null;
      }
    });

    const results = await Promise.all(frontierCalls);

    let newFrontier = [];

    for (const result of results) {
      if (!result) continue;

      // Merge object nodes with adjusted distances
      for (const n of result.object_lineage?.nodes || []) {
        if (!visited.has(n.id)) {
          visited.add(n.id);
          const adjustedNode = {
            ...n,
            distance: (Number(n.distance) || 0) + distanceOffset,
          };
          allObjNodes.set(n.id, adjustedNode);

          // Collect new frontier (nodes at max distance in this sub-call)
          if (Number(n.distance) === callDistance) {
            newFrontier.push(adjustedNode);
          }
        }
      }

      // Merge object edges
      for (const e of result.object_lineage?.edges || []) {
        const eid = e.id || `${e.source}__${e.target}`;
        if (!allObjEdges.has(eid)) {
          allObjEdges.set(eid, e);
        }
      }

      // Merge column nodes
      for (const n of result.column_lineage?.nodes || []) {
        if (!allColNodes.has(n.id)) {
          allColNodes.set(n.id, {
            ...n,
            distance: (Number(n.distance) || 0) + distanceOffset,
          });
        }
      }

      // Merge column edges
      const rColEdges = result.column_lineage?.edges || {};
      Object.assign(allColEdges, rColEdges);
    }

    frontier = newFrontier;
    remainingDistance -= callDistance;
  }

  // Build final merged payload
  return {
    object_lineage: {
      nodes: Array.from(allObjNodes.values()),
      edges: Array.from(allObjEdges.values()),
    },
    column_lineage: {
      nodes: Array.from(allColNodes.values()),
      edges: allColEdges,
    },
    meta: { ...(payload.meta || {}), max_distance: totalDistance },
  };
}

// Working Version of /lineage route
app.get("/lineage", async (req, res) => {
  try {
    const q = req.query || {};

    const db = String(q.dbName || "")
      .trim()
      .toUpperCase();
    const schema = String(q.schemaName || "")
      .trim()
      .toUpperCase();
    const objectName = String(q.objectName || "")
      .trim()
      .toUpperCase();
    const objectType = String(q.objectType || "")
      .trim()
      .toUpperCase();
    const includeColumn =
      String(q.includeColumn || "no").toLowerCase() === "yes";
    const columnName = includeColumn
      ? String(q.columnName || "")
          .trim()
          .toUpperCase()
      : null;
    const direction = String(q.direction || "BOTH")
      .trim()
      .toUpperCase();
    const distance = q.distance ? String(q.distance).trim() : "3";
    const numDistance = Number(distance) || 3;

    let payload;

    if (direction === "BOTH") {
      // Snowflake GET_LINEAGE does not support "BOTH" directly.
      // Make two parallel calls (UPSTREAM + DOWNSTREAM) with recursive chaining and merge results.
      const [upPayload, downPayload] = await Promise.all([
        fetchRecursiveLineage(
          db,
          schema,
          objectName,
          objectType,
          columnName,
          includeColumn,
          "UPSTREAM",
          numDistance,
        ),
        fetchRecursiveLineage(
          db,
          schema,
          objectName,
          objectType,
          columnName,
          includeColumn,
          "DOWNSTREAM",
          numDistance,
        ),
      ]);
      payload = mergeLineagePayloads(upPayload, downPayload);
    } else {
      payload = await fetchRecursiveLineage(
        db,
        schema,
        objectName,
        objectType,
        columnName,
        includeColumn,
        direction,
        numDistance,
      );
    }

    const objectLineage = payload.object_lineage || { nodes: [], edges: [] };
    const columnLineage = payload.column_lineage || { nodes: [], edges: {} };

    if (!includeColumn && objectLineage.nodes.length > 0) {
      try {
        const nodeIds = objectLineage.nodes.map(n => n.id.toUpperCase());
        const placeholders = nodeIds.map(() => '?').join(',');
        const extSql = `
          SELECT SOURCE_ID, SOURCE_NAMESPACE, SOURCE_NAME, SOURCE_TYPE,
                 TARGET_DATABASE, TARGET_SCHEMA, TARGET_TABLE, DESCRIPTION
          FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_EXTERNAL_LINEAGE_SOURCES
          WHERE IS_ACTIVE = TRUE
            AND (TARGET_DATABASE || '.' || TARGET_SCHEMA || '.' || TARGET_TABLE) IN (${placeholders})
        `;
        const extRows = await new Promise((resolve, reject) => {
          connection.execute({
            sqlText: extSql,
            binds: nodeIds,
            complete: (err, _stmt, rows) => err ? reject(err) : resolve(rows || []),
          });
        });

        for (const ext of extRows) {
          const extId = `EXT::${ext.SOURCE_TYPE}::${ext.SOURCE_NAMESPACE}/${ext.SOURCE_NAME}`;
          const targetFqn = `${ext.TARGET_DATABASE}.${ext.TARGET_SCHEMA}.${ext.TARGET_TABLE}`;

          objectLineage.nodes.push({
            id: extId,
            type: ext.SOURCE_TYPE.toLowerCase(),
            domain: "EXTERNAL",
            database: ext.SOURCE_NAMESPACE,
            schema: ext.SOURCE_TYPE,
            name: ext.SOURCE_NAME,
            distance: -1,
            isExternal: true,
            sourceNamespace: ext.SOURCE_NAMESPACE,
            sourceName: ext.SOURCE_NAME,
            description: ext.DESCRIPTION,
          });

          objectLineage.edges.push({
            id: `${extId}->${targetFqn}`,
            source: extId,
            target: targetFqn,
            type: "EXTERNAL_INGEST",
          });
        }
      } catch (extErr) {
        console.warn("[/lineage] External sources merge failed (non-fatal):", extErr.message);
      }
    }

    const finalPayload = includeColumn
      ? { column_lineage: columnLineage, meta: payload.meta }
      : { object_lineage: objectLineage, meta: payload.meta };

    return res.json(finalPayload);
  } catch (e) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: e.message || String(e),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: e.statementId || "UNKNOWN",
    });
    return res.status(500).json({ error: e.message || String(e) });
  }
});

// Freshness/staleness endpoint: returns LAST_ALTERED timestamps for lineage nodes
app.get("/lineage/freshness", async (req, res) => {
  try {
    const objects = String(req.query.objects || "").trim();
    if (!objects) return res.json({});

    const fqns = objects
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (fqns.length === 0) return res.json({});

    // Group by DB.SCHEMA for efficient querying
    const groups = new Map(); // key: "DB.SCHEMA" -> [TABLE_NAME, ...]
    for (const fqn of fqns) {
      const parts = fqn.split(".");
      if (parts.length < 3) continue;
      const db = parts[0];
      const schema = parts[1];
      const tableName = parts.slice(2).join(".");
      const groupKey = `${db}.${schema}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(tableName);
    }

    const result = {};

    // Query each DB.SCHEMA group
    const queries = Array.from(groups.entries()).map(
      async ([groupKey, tableNames]) => {
        const [dbName, schemaName] = groupKey.split(".");
        const placeholders = tableNames.map(() => "?").join(",");
        const sql = `SELECT TABLE_CATALOG || '.' || TABLE_SCHEMA || '.' || TABLE_NAME AS FQN, LAST_ALTERED, TABLE_TYPE FROM "${dbName}".INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${placeholders})`;
        const binds = [schemaName, ...tableNames];

        try {
          const rows = await new Promise((resolve, reject) => {
            connection.execute({
              sqlText: sql,
              binds,
              complete: (err, _stmt, rows) =>
                err ? reject(err) : resolve(rows || []),
            });
          });
          for (const row of rows) {
            const fqn = row.FQN || row.fqn;
            const lastAltered = row.LAST_ALTERED || row.last_altered;
            const tableType = row.TABLE_TYPE || row.table_type || "";
            if (fqn) {
              result[fqn] = { lastAltered, tableType };
            }
          }
        } catch (err) {
          // Skip groups that fail (e.g., no access to that DB)
          console.warn(
            `Freshness query failed for ${groupKey}: ${err.message}`,
          );
        }
      },
    );

    await Promise.all(queries);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
});

// Post requests to save lineage graph config to Snowflake
app.post('/save-graph', async (req, res) => {
  try {
    const {
      graphId,
      graphName,
      databaseName,
      schemaName,
      objectName,
      objectType,
      direction,
      distance,
      includeColumn,
      graphPayload,
      createdBy,
    } = req.body;

    if (!graphId || !graphName || !databaseName || !schemaName || !objectName) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const sql = `
      INSERT INTO ${DATABASE}.${SCHEMA}.GRAPH_CONFIGS
        (GRAPH_ID, GRAPH_NAME, DATABASE_NAME, SCHEMA_NAME, OBJECT_NAME, OBJECT_TYPE, DIRECTION, DISTANCE, INCLUDE_COLUMN, GRAPH_PAYLOAD, CREATED_BY)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, PARSE_JSON(?), ?
    `;

    await execWithBinds(sql, [
      graphId,
      graphName,
      databaseName,
      schemaName,
      objectName,
      objectType || null,
      direction || null,
      distance != null ? Number(distance) : null,
      includeColumn === true || includeColumn === "yes",
      graphPayload ? JSON.stringify(graphPayload) : null,
      createdBy || req.headers["x-user-id"] || "unknown",
    ]);

    return res.json({ success: true, message: "Graph saved successfully" });
  } catch (e) {
    logAuditError({
      eventType: "LINEAGE_ERROR",
      errorMessage: e.message || String(e),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
        body: req.body,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: e.statementId || "UNKNOWN",
    });
    return res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// GET all saved graph configs from Snowflake
app.get('/graphs', async (req, res) => {
  try {
    const sql = `
      SELECT GRAPH_ID, GRAPH_NAME, DATABASE_NAME, SCHEMA_NAME, OBJECT_NAME, OBJECT_TYPE,
             DIRECTION, DISTANCE, INCLUDE_COLUMN, CREATED_BY, CREATED_AT
      FROM ${DATABASE}.${SCHEMA}.GRAPH_CONFIGS
      ORDER BY CREATED_AT DESC
    `;
    const rows = await execQuery(sql);
    return res.json({ success: true, data: rows });
  } catch (e) {
    logAuditError({
      eventType: "LINEAGE_ERROR",
      errorMessage: e.message || String(e),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: e.statementId || "UNKNOWN",
    });
    return res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// DELETE a saved graph config by ID
app.delete('/graphs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "Graph ID is required" });
    }

    const sql = `
      DELETE FROM ${DATABASE}.${SCHEMA}.GRAPH_CONFIGS
      WHERE GRAPH_ID = ?
    `;
    await execWithBinds(sql, [id]);
    return res.json({ success: true, message: "Graph deleted successfully" });
  } catch (e) {
    logAuditError({
      eventType: "LINEAGE_ERROR",
      errorMessage: e.message || String(e),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
        params: req.params,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: e.statementId || "UNKNOWN",
    });
    return res.status(500).json({ success: false, error: e.message || String(e) });
  }
})


// ---- Graph transformer (edges -> React Flow nodes/edges) ----
function nodeId(db, schema, name) {
  return `[${db}].[${schema}].[${name}]`;
}
function toLabel(db, schema, name) {
  return `${db}.${schema}.${name}`;
}
function buildGraph(
  upstreamEdges,
  downstreamEdges,
  { db, schema, objectName },
) {
  const nodesMap = new Map();
  const edgesList = [];

  const addNode = (
    dbName,
    schName,
    objName,
    domain,
    status,
    isRoot = false,
  ) => {
    const id = nodeId(dbName, schName, objName);
    if (!nodesMap.has(id)) {
      nodesMap.set(id, {
        id,
        label: toLabel(dbName, schName, objName),
        domain: domain || "TABLE",
        status: status || null,
        isRoot,
      });
    } else if (isRoot) {
      nodesMap.get(id).isRoot = true;
    }
  };

  const addEdge = (
    srcDb,
    srcSch,
    srcName,
    tgtDb,
    tgtSch,
    tgtName,
    directionTag,
    distance,
  ) => {
    const source = nodeId(srcDb, srcSch, srcName);
    const target = nodeId(tgtDb, tgtSch, tgtName);
    edgesList.push({
      id: `${source}->${target}`,
      source,
      target,
      direction: directionTag,
      distance,
    });
  };

  // root node (focal object)
  addNode(db, schema, objectName, null, null, true);

  const process = (edges, tag) => {
    edges.forEach((e) => {
      addNode(
        e.SOURCE_OBJECT_DATABASE,
        e.SOURCE_OBJECT_SCHEMA,
        e.SOURCE_OBJECT_NAME,
        e.SOURCE_OBJECT_DOMAIN,
        e.SOURCE_STATUS,
      );
      addNode(
        e.TARGET_OBJECT_DATABASE,
        e.TARGET_OBJECT_SCHEMA,
        e.TARGET_OBJECT_NAME,
        e.TARGET_OBJECT_DOMAIN,
        e.TARGET_STATUS,
      );
      addEdge(
        e.SOURCE_OBJECT_DATABASE,
        e.SOURCE_OBJECT_SCHEMA,
        e.SOURCE_OBJECT_NAME,
        e.TARGET_OBJECT_DATABASE,
        e.TARGET_OBJECT_SCHEMA,
        e.TARGET_OBJECT_NAME,
        tag,
        e.DISTANCE,
      );
    });
  };

  process(upstreamEdges, "UPSTREAM");
  process(downstreamEdges, "DOWNSTREAM");

  return { nodes: Array.from(nodesMap.values()), edges: edgesList };
}

app.get("/api/response", (req, res) => {
  const query =
    "SELECT * FROM flattened_ai_event WHERE agent_name = 'UNSTRUCTURED_DATA';";

  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("Error executing query:", err);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        return res.status(500).json({ error: "Failed to fetch data" });
      }
      res.json({ data: rows });
    },
  });
});
const HOST = "PIHJDMO-SFCOCOHOL.snowflakecomputing.com";
const DATABASE = "D_IN_CAPG_POC_AI_SCALABILITY";
const SCHEMA = "AI_SCALABILITY_SCHEMA";
const AGENT = "AGENT_UNSTRUCTURED";
const AGENT_STRUCTURED = "STRUCTURED_DATA_AGENT"; //-- added for talk to data
const WAREHOUSE = "W_IN_CAPG_AI_SCALABILITY_SOL_XS";
const MAPPING_AGENT = "DATA_COMPLIANCE";
const POLICY_AGENT = "POLICY_SCANNER";
const AUTH_TOKEN = process.env.SNOWFLAKE_AUTH_TOKEN;

/* ------------------------------------------------------------------ */
/* Auth headers helper + JWT cache placeholder                         */
/* ------------------------------------------------------------------ */
const _jwtCache = { token: null, expiresAt: 0 };

async function getCortexAuthHeaders() {
  // Use the programmatic access token from environment
  const token = AUTH_TOKEN;
  if (!token) {
    throw new Error("Missing SNOWFLAKE_AUTH_TOKEN in environment");
  }
  return { Authorization: `Bearer ${token}` };
}

/* ------------------------------------------------------------------ */
/* Retry + JSON helpers                                                */
/* ------------------------------------------------------------------ */
const retryWithBackoff = async (fn, maxRetries = 10, maxDuration = 120000) => {
  const startTime = Date.now();
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (Date.now() - startTime > maxDuration) {
      throw new Error(`Retry timeout after ${maxDuration}ms`);
    }
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.log(
        `Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        error?.message || error,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
};

// API FOR TALK TO DOCUMENT CHAT MODEL

const safeJsonParse = (str) => {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/* Model selection (from your snippet)                                 */
/* ------------------------------------------------------------------ */
const ALLOWED_MODELS = new Set([
  "claude-4-sonnet",
  "claude-3-5-sonnet",
  "claude-3-7-sonnet",
  "llama3.1-8b",
  "llama3.1-70b",
  "llama3-70b",
  "mistral-large",
  "mistral-large2",
  "mixtral-8x7b",
  "deepseek-r1",
  "snowflake-llama-3.3-70b",
  "openai-gpt-4.1",
]);

function parseSelectedModels(input) {
  if (!input) return [];
  let arr = Array.isArray(input) ? input : String(input).split(",");
  arr = arr.map((s) => s.trim()).filter(Boolean);

  // de-dupe preserving order
  const seen = new Set();
  const unique = [];
  for (const m of arr) {
    if (!seen.has(m)) {
      unique.push(m);
      seen.add(m);
    }
  }
  return unique;
}

function validateSelectedModels(models, { required = false } = {}) {
  if (required && models.length === 0) {
    return {
      ok: false,
      message: "selected_models is required (min 1, max 3).",
    };
  }
  if (models.length > 3) {
    return {
      ok: false,
      message: "selected_models cannot include more than 3 models.",
    };
  }
  if (models.length === 0) return { ok: true };
  const invalid = models.filter((m) => !ALLOWED_MODELS.has(m));
  if (invalid.length) {
    return {
      ok: false,
      message: `Unsupported models: ${invalid.join(", ")}. Allowed: ${[...ALLOWED_MODELS].join(", ")}`,
    };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Tool-result parsers                                                 */
/* ------------------------------------------------------------------ */
const parseCitationResult = (toolResultObj) => {
  // 'citation' tool_result: content[0].json.result is a JSON *string*
  const inner = toolResultObj?.content?.[0]?.json?.result;
  return inner ? safeJsonParse(inner) : null; // { citations: {...}, message?: "..." }
};

const parseMultiModelResult = (toolResultObj) => {
  // 'multi_model_response' tool_result: JSON *string* map
  const inner = toolResultObj?.content?.[0]?.json?.result;
  const parsed = inner ? safeJsonParse(inner) : null; // { "mistral-large2": "...", "llama3.1-70b": "...", ... }
  return parsed && typeof parsed === "object" ? parsed : null;
};

/* ------------------------------------------------------------------ */
/* Text scrapers for document mentions (pdf, txt, doc, docx)          */
/* ------------------------------------------------------------------ */
const CITATION_EXT_RE = /\.(pdf|txt|docx|doc)$/i;
// Matches plain filenames WITHOUT spaces (word-boundary safe). docx must come before doc.
const PLAIN_FILE_RE = /\b([A-Za-z0-9._-]+\.(pdf|txt|docx|doc))\b/gi;
// Matches filenames with spaces inside square brackets: [Banking 1.pdf], [My Report.docx]
const BRACKET_FILE_RE = /\[([^\]]*?\.(pdf|txt|docx|doc))\]/gi;
// Matches filenames with spaces in common citation patterns: "Citations: Banking 1.pdf, Finance.docx"
// Captures: word(s) + spaces + ending in .ext, preceded by line start, comma, colon, or bracket
const SPACED_FILE_RE =
  /(?:^|[,:\[\]]\s*)((?:[A-Za-z0-9][\w ]*?)\.(pdf|txt|docx|doc))\b/gi;

const extractDocumentMentions = (text) => {
  if (typeof text !== "string" || !text) return [];
  const found = new Set();

  // [label](url) — markdown links
  const mdLink = /\[([^\]]+?)\]\(([^)]+)\)/gi;
  let m;
  while ((m = mdLink.exec(text)) !== null) {
    const label = (m[1] || "").trim();
    const url = (m[2] || "").trim();

    if (CITATION_EXT_RE.test(label)) {
      found.add(label);
    } else {
      const last = url.split(/[/?#]/).pop();
      if (last && CITATION_EXT_RE.test(last)) found.add(last);
    }
  }

  // Square-bracket references: [Banking 1.pdf], [My Doc.txt]
  BRACKET_FILE_RE.lastIndex = 0;
  let b;
  while ((b = BRACKET_FILE_RE.exec(text)) !== null) {
    const name = (b[1] || "").trim();
    if (name) found.add(name);
  }

  // Spaced filenames in citation patterns: "Banking 1.pdf", "Finance Report.docx"
  SPACED_FILE_RE.lastIndex = 0;
  let s;
  while ((s = SPACED_FILE_RE.exec(text)) !== null) {
    const name = (s[1] || "").trim();
    if (name && name.length > 2) found.add(name);
  }

  // Plain filename mentions without spaces: Banking.pdf, notes.txt, report.docx
  PLAIN_FILE_RE.lastIndex = 0;
  let p;
  while ((p = PLAIN_FILE_RE.exec(text)) !== null) {
    // Skip if this is a partial match of a longer spaced filename already found
    const match = p[1];
    const alreadyCovered = [...found].some(
      (f) => f.endsWith(match) && f !== match,
    );
    if (!alreadyCovered) {
      found.add(match);
    }
  }

  // Remove partial matches: if we have both "1.pdf" and "Banking 1.pdf", remove "1.pdf"
  const results = [...found];
  const filtered = results.filter((name) => {
    // Keep this entry unless another longer entry ends with it
    return !results.some((other) => other !== name && other.endsWith(name));
  });

  return filtered;
};

/* ------------------------------------------------------------------ */
/*               MAIN: segregated streaming route (SSE)               */
/* ------------------------------------------------------------------ */
app.post("/api/agent", async (req, res) => {
  try {
    // Build prompt + selected models
    const rawUserPrompt =
      req.body && (req.body.prompt || req.body.query)
        ? req.body.prompt || req.body.query
        : "";

    const selectedModelsRaw = req.body?.selected_models;
    const selectedModels = parseSelectedModels(selectedModelsRaw);

    const REQUIRE_SELECTED = true;
    const val = validateSelectedModels(selectedModels, {
      required: REQUIRE_SELECTED,
    });
    if (!val.ok) return res.status(400).json({ error: val.message });

    const modelPreferenceSection = selectedModels.length
      ? `\n\n**CRITICAL – Selected Models (ALL REQUIRED):**\nYou MUST use ALL of the following models when calling multi_model_response. Pass them ALL in the selected_models parameter as a comma-separated string. Do NOT pick only one — use ALL of them:\nselected_models: "${selectedModels.join(",")}"\n`
      : "";
    const retryWithBackoff = async (
      fn,
      maxRetries = 10,
      maxDuration = 120000,
    ) => {
      const startTime = Date.now();
      let lastError;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (Date.now() - startTime > maxDuration) {
          throw new Error(`Retry timeout after ${maxDuration}ms`);
        }
        try {
          return await fn();
        } catch (error) {
          const status = error?.response?.status;
          // Do not retry auth errors – they are not transient
          if (status === 401 || status === 403) {
            console.error(
              `[AGENT] Auth error (${status}), clearing token cache and failing immediately`,
            );
            _jwtCache.token = null;
            _jwtCache.expiresAt = 0;
            throw error;
          }

          lastError = error;
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(
            `Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
            error?.message || error,
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      throw lastError;
    };

    const pipelineId = req.body?.pipeline_id || "";

    // ---- Fetch allowed documents for this pipeline (for citation filtering) ----
    let allowedDocuments = null; // null = no filtering
    if (pipelineId) {
      try {
        const metaRows = await execWithBinds(
          `SELECT FILE_TYPE FROM R_PIPELINE_METADATA_TBL WHERE pipeline_id = ? LIMIT 1`,
          [pipelineId],
        );
        const fileTypeStr =
          metaRows?.[0]?.FILE_TYPE ?? metaRows?.[0]?.file_type ?? "";
        if (fileTypeStr) {
          allowedDocuments = new Set(
            fileTypeStr
              .split(",")
              .map((f) => f.trim().toLowerCase())
              .filter(Boolean),
          );
        }
      } catch (e) {
        console.warn(
          "[/api/agent] Could not fetch pipeline documents for filtering:",
          e.message,
        );
      }
    }

    // Filter citation documents to only those belonging to the selected pipeline
    const filterByPipeline = (docs) => {
      if (!allowedDocuments || allowedDocuments.size === 0) return docs;
      return docs.filter((d) => {
        const name = typeof d === "string" ? d : d?.name;
        if (!name) return false;
        const nameLower = name.toLowerCase();
        // Exact match or basename match (handles paths like "stage/file.pdf")
        return (
          allowedDocuments.has(nameLower) ||
          [...allowedDocuments].some(
            (allowed) =>
              nameLower === allowed || nameLower.endsWith("/" + allowed),
          )
        );
      });
    };

    const pipelineSection = pipelineId
      ? `\n\n**pipeline_id:** ${pipelineId}\nYou MUST use the pipeline_search tool with this pipeline_id to search for relevant documents and include citations from those documents in your response. Always cite the source documents in the format: Citations: [filename.pdf] or [filename.txt] or [filename.docx].\n`
      : "";

    const prompt = rawUserPrompt
      ? `**Follow these rules:**\n\n1. The output response should be in **React Markdown** format.\n2. Ensure proper **indentation**, **bold text**, and **styling** according to React Markdown.\n3. Always include citations at the end of your response listing all source documents you referenced in the format: Citations: [filename.pdf] or [filename.txt] or [filename.docx]. If no documents were referenced, still include Citations: [] to indicate none.${modelPreferenceSection}${pipelineSection}\n---\n\n**User Prompt:**\n${rawUserPrompt}`
      : "";

    if (!prompt.trim())
      return res.status(400).json({ error: "Prompt (or query) is required" });

    console.log(
      "[/api/agent] pipeline_id:",
      pipelineId || "(none)",
      "models:",
      selectedModels,
    );

    const url = `https://${HOST}/api/v2/databases/${DATABASE}/schemas/${SCHEMA}/agents/${AGENT}:run`;
    const authHeaders = await getCortexAuthHeaders();
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...authHeaders,
    };

    const requestBody = {
      agent: `${DATABASE}.${SCHEMA}.${AGENT}`,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      context: { warehouse: WAREHOUSE, database: DATABASE, schema: SCHEMA },
      options: { allow_execution: true },
    };

    const tryRequest = async (rejectUnauthorized) => {
      const httpsAgent = new https.Agent({ rejectUnauthorized });
      return axios.post(url, requestBody, {
        headers,
        responseType: "stream",
        httpsAgent, // <— correct axios option
        timeout: 60_000,
        decompress: true,
        maxRedirects: 0,
      });
    };

    let response;
    try {
      response = await retryWithBackoff(() => tryRequest(true));
    } catch (err) {
      console.warn(
        "TLS verification failed, retrying without certificate verification:",
        err?.message || err,
      );
      response = await retryWithBackoff(() => tryRequest(false));
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Announce selected models to the UI
    if (selectedModels.length) {
      res.write(
        `data: ${JSON.stringify({ selected_models: selectedModels })}\n\n`,
      );
    }

    const stream = response.data;
    let buffer = "";
    const emittedModels = new Set();
    let thinkingStarted = false;

    // Track emitted citations to avoid duplicates
    let accumulatedText = "";
    const emittedCitations = new Set();

    const writeData = (obj) => {
      if (obj?.documents)
        console.log(
          "[SSE-CITATION] Emitting documents ->",
          JSON.stringify(obj.documents),
        );
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

    const handlePayload = (payloadStr) => {
      if (payloadStr === "[DONE]") return;

      const obj = safeJsonParse(payloadStr);

      if (!obj) {
        // non-JSON → forward as text
        writeData({ text: payloadStr });
        return;
      }

      // status-only → skip (but don't skip if delta or content present)
      if (obj.status && obj.message && !obj.text && !obj.content && !obj.delta)
        return;

      /* --------------------------------------------
         (A) Inline Cortex Search citation, top-level
         -------------------------------------------- */
      if (obj?.annotation?.type === "cortex_search_citation") {
        const docId = obj?.annotation?.doc_id;
        if (docId) {
          const filtered = filterByPipeline([{ name: docId }]);
          if (filtered.length > 0) writeData({ documents: filtered });
        }
        return;
      }

      /* --------------------------------------------
         (A2) Cortex Agent v2: delta.content[] wrapper
              (event: message.content.delta)
              Contains annotations and text parts
         -------------------------------------------- */
      if (obj?.delta?.content && Array.isArray(obj.delta.content)) {
        const citationDocs = [];
        for (const part of obj.delta.content) {
          // Citation annotations inside delta
          if (
            part?.type === "annotation" &&
            part?.annotation?.type === "cortex_search_citation"
          ) {
            const docId =
              part.annotation.doc_id ||
              part.annotation.source ||
              part.annotation.source_doc ||
              part.annotation.document;
            if (docId) citationDocs.push({ name: docId });
          }
          // Text streaming deltas
          if (part?.type === "text" && typeof part?.text === "string") {
            accumulatedText += part.text;
            writeData({ text: part.text });
            thinkingStarted = true;
          }
        }
        if (citationDocs.length > 0) {
          const filtered = filterByPipeline(citationDocs);
          if (filtered.length > 0) {
            filtered.forEach((d) => emittedCitations.add(d.name.toLowerCase()));
            console.log("[SSE-CITATION] delta.content annotations:", filtered);
            writeData({ documents: filtered });
          }
        }
        return;
      }

      /* --------------------------------------------
         (A3) Cortex Agent v2: top-level content[] with annotations
              (non-role events, tool results, etc.)
         -------------------------------------------- */
      if (Array.isArray(obj?.content) && !obj?.role && !obj?.type) {
        const citationDocs = [];
        for (const part of obj.content) {
          if (
            part?.type === "annotation" &&
            part?.annotation?.type === "cortex_search_citation"
          ) {
            const docId =
              part.annotation.doc_id ||
              part.annotation.source ||
              part.annotation.source_doc ||
              part.annotation.document;
            if (docId) citationDocs.push({ name: docId });
          }
          if (part?.type === "text" && typeof part?.text === "string") {
            accumulatedText += part.text;
            writeData({ text: part.text });
            thinkingStarted = true;
          }
        }
        if (citationDocs.length > 0) {
          const filtered = filterByPipeline(citationDocs);
          if (filtered.length > 0) {
            filtered.forEach((d) => emittedCitations.add(d.name.toLowerCase()));
            console.log("[SSE-CITATION] content[] annotations:", filtered);
            writeData({ documents: filtered });
          }
        }
        return;
      }

      /* --------------------------------------------
         (B) Thinking / narrative deltas:
             - parse embedded JSON inside text
             - extract document mentions from text, filtered by pipeline
         -------------------------------------------- */
      if (typeof obj.text === "string") {
        // Accumulate text for citation extraction
        accumulatedText += obj.text;

        // Embedded JSON: {"annotation": {...}} placed inside text
        const inner = safeJsonParse(obj.text);
        if (inner?.annotation?.type === "cortex_search_citation") {
          const docId = inner.annotation.doc_id;
          if (docId) {
            const filtered = filterByPipeline([{ name: docId }]);
            if (filtered.length > 0) {
              filtered.forEach((d) =>
                emittedCitations.add(d.name.toLowerCase()),
              );
              writeData({ documents: filtered });
            }
          }
          // fall through to still stream visible text
        }

        // Extract document mentions from accumulated text, filtered by pipeline
        const names = extractDocumentMentions(accumulatedText);
        if (names.length > 0) {
          const newNames = names.filter(
            (n) => !emittedCitations.has(n.toLowerCase()),
          );
          if (newNames.length > 0) {
            const docs = newNames.map((n) => ({ name: n }));
            const filtered = filterByPipeline(docs);
            if (filtered.length > 0) {
              filtered.forEach((d) =>
                emittedCitations.add(d.name.toLowerCase()),
              );
              writeData({ documents: filtered });
            }
          }
        }

        writeData({ text: obj.text }); // keep your visible narrative stream
        thinkingStarted = true;
        return;
      }

      /* --------------------------------------------
         (C) Tool-based citation result → documents[]
         -------------------------------------------- */
      if (
        obj.type === "generic" &&
        obj.name === "citation" &&
        obj.status === "success"
      ) {
        const parsed = parseCitationResult(obj);
        if (parsed?.citations) {
          const docs = Object.values(parsed.citations)
            .map((c) => c.document)
            .filter(Boolean)
            .map((name) => ({ name }));
          const filtered = filterByPipeline(docs);
          if (filtered.length > 0) writeData({ documents: filtered });
        }
        return;
      }

      /* --------------------------------------------
         (D) Per-model responses
         -------------------------------------------- */
      if (
        obj.type === "generic" &&
        obj.name === "multi_model_response" &&
        obj.status === "success"
      ) {
        const modelMap = parseMultiModelResult(obj);
        if (modelMap) {
          for (const [modelName, text] of Object.entries(modelMap)) {
            const id = `model:${modelName}`;
            if (!emittedModels.has(id)) {
              // Extract citations from per-model response text, filtered by pipeline
              accumulatedText += text;
              const names = extractDocumentMentions(text);
              if (names.length > 0) {
                const newCitations = names.filter(
                  (n) => !emittedCitations.has(n.toLowerCase()),
                );
                if (newCitations.length > 0) {
                  const docs = newCitations.map((n) => ({ name: n }));
                  const filtered = filterByPipeline(docs);
                  if (filtered.length > 0) {
                    filtered.forEach((d) =>
                      emittedCitations.add(d.name.toLowerCase()),
                    );
                    writeData({ documents: filtered });
                  }
                }
              }
              writeData({ model: modelName, text });
              emittedModels.add(id);
            }
          }
        }
        return;
      }

      // cortex_search success → extract source docs from results if present
      if (obj.type === "cortex_search" && obj.status === "success") {
        if (Array.isArray(obj?.content)) {
          const citationDocs = [];
          for (const part of obj.content) {
            if (part?.type === "json" && part?.json) {
              const jsonData =
                typeof part.json === "string"
                  ? safeJsonParse(part.json)
                  : part.json;
              if (jsonData?.results && Array.isArray(jsonData.results)) {
                for (const r of jsonData.results) {
                  const name =
                    r?.source_doc ||
                    r?.document ||
                    r?.doc_id ||
                    r?.source ||
                    r?.file_name ||
                    r?.relative_path;
                  if (name) citationDocs.push({ name });
                }
              }
            }
            if (
              part?.type === "annotation" &&
              part?.annotation?.type === "cortex_search_citation"
            ) {
              const docId =
                part.annotation.doc_id ||
                part.annotation.source ||
                part.annotation.source_doc;
              if (docId) citationDocs.push({ name: docId });
            }
          }
          if (citationDocs.length > 0) {
            const seen = new Set();
            const unique = citationDocs.filter((d) => {
              if (seen.has(d.name)) return false;
              seen.add(d.name);
              return true;
            });
            const filtered = filterByPipeline(unique);
            if (filtered.length > 0) {
              console.log("[SSE-CITATION] cortex_search results:", filtered);
              writeData({ documents: filtered });
            }
          }
        }
        return;
      }

      // final assistant (may include thinking + citations)
      if (Array.isArray(obj?.content) && obj?.role === "assistant") {
        const citationDocs = [];
        for (const part of obj.content) {
          if (
            part?.type === "annotation" &&
            part?.annotation?.type === "cortex_search_citation"
          ) {
            const docId =
              part.annotation.doc_id ||
              part.annotation.source ||
              part.annotation.source_doc;
            if (docId) citationDocs.push({ name: docId });
          }
          if (
            part?.type === "text" &&
            typeof part?.text === "string" &&
            !thinkingStarted
          ) {
            writeData({ text: part.text });
            thinkingStarted = true;
          }
          if (
            part?.type === "thinking" &&
            part?.thinking?.text &&
            !thinkingStarted
          ) {
            writeData({ text: part.thinking.text });
          }
        }
        if (citationDocs.length > 0) {
          const filtered = filterByPipeline(citationDocs);
          if (filtered.length > 0) {
            console.log(
              "[SSE-CITATION] assistant content annotations:",
              filtered,
            );
            writeData({ documents: filtered });
          }
        }
        return;
      }

      // fallback
      writeData({ text: payloadStr });
    };

    // Stream reader loop — proper SSE protocol: track event: type, accumulate data:, flush on blank line
    let currentEventType = null;
    let dataBuf = "";

    const flushEvent = () => {
      if (!dataBuf) return;
      handlePayload(dataBuf.trim());
      dataBuf = "";
      currentEventType = null;
    };

    stream.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      let eol;
      while ((eol = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, eol).replace(/\r$/, "");
        buffer = buffer.slice(eol + 1);

        if (line.startsWith("event:")) {
          currentEventType = line.slice(6).trim();
          continue;
        }
        if (line.startsWith("data:")) {
          dataBuf += line.slice(5).trimStart();
          continue;
        }
        // Blank line = end of SSE event → flush
        if (line.trim() === "") {
          flushEvent();
        }
      }
    });

    stream.on("end", () => {
      flushEvent(); // flush any remaining buffered event

      // Final citation extraction from all accumulated text, filtered by pipeline
      const finalNames = extractDocumentMentions(accumulatedText);
      if (finalNames.length > 0) {
        const newCitations = finalNames.filter(
          (n) => !emittedCitations.has(n.toLowerCase()),
        );
        if (newCitations.length > 0) {
          const docs = newCitations.map((n) => ({ name: n }));
          const filtered = filterByPipeline(docs);
          if (filtered.length > 0) {
            filtered.forEach((d) => emittedCitations.add(d.name.toLowerCase()));
            console.log(
              "[SSE-CITATION] Final extraction (filtered):",
              filtered,
            );
            writeData({ documents: filtered });
          }
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    });

    stream.on("error", (err) => {
      console.error("SSE stream error:", err);
      try {
        res.status(500).json({ error: err.message || String(err) });
      } catch {
        res.end();
      }
    });
  } catch (error) {
    const upstreamStatus = error?.response?.status;
    console.error(
      "Agent endpoint error:",
      upstreamStatus || "",
      error?.message || error,
    );
    logAuditError({
      eventType: "ERROR",
      errorMessage: error.message || String(error),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: error.statementId || "UNKNOWN",
    });
    const statusCode =
      upstreamStatus === 401 || upstreamStatus === 403 ? upstreamStatus : 500;
    res.status(statusCode).json({ error: error.message || String(error) });
  }
});

// for talk to data
// Debug toggle (optional)
const DEBUG_SSE = process.env.DEBUG_SSE === "true";
// for talk to data

function tryJson(s) {
  try {
    return typeof s === "string" ? JSON.parse(s) : s;
  } catch {
    return null;
  }
}

// Capture text + SQL by event type

function processSseEvent(eventName, payload, acc) {
  if (eventName === "message.content.delta" && payload?.delta?.content) {
    for (const part of payload.delta.content) collectContent(part, acc);

    return;
  }

  if (
    (eventName === "message" || eventName === "message.delta") &&
    Array.isArray(payload?.content)
  ) {
    for (const part of payload.content) collectContent(part, acc);

    return;
  }

  deepScan(payload, (arr) => arr.forEach((p) => collectContent(p, acc)));

  const maybe =
    payload?.text ?? payload?.message ?? payload?.output ?? payload?.content;

  if (typeof maybe === "string" && looksSql(maybe))
    acc.sqlCandidates.push(maybe);
  else if (typeof maybe === "string") acc.answerText += maybe;
}

function collectContent(part, acc) {
  if (!part || typeof part !== "object") return;

  if (part.type === "text" && typeof part.text === "string")
    acc.answerText += part.text;

  if (part.type === "json" && part.json) {
    const sql = findSql(part.json);

    if (sql) acc.sqlCandidates.push(sql);
  }

  if (part.type === "sql" && (part.sql || part.text))
    acc.sqlCandidates.push(part.sql || part.text);
}

function deepScan(o, cb) {
  if (!o || typeof o !== "object") return;

  if (Array.isArray(o)) {
    if (o.some((x) => x && typeof x === "object" && "type" in x)) {
      cb(o);
      return;
    }

    for (const it of o) deepScan(it, cb);

    return;
  }

  for (const k of Object.keys(o)) deepScan(o[k], cb);
}

function findSql(obj) {
  if (!obj || typeof obj !== "object") return "";

  if (typeof obj.sql === "string" && looksSql(obj.sql)) return obj.sql;

  for (const k of Object.keys(obj)) {
    const v = obj[k];

    const found = typeof v === "object" ? findSql(v) : "";

    if (found) return found;
  }

  return "";
}

function looksSql(s) {
  return /^\s*(with|select|insert|update|delete|merge|call)\b/i.test(
    String(s || ""),
  );
}

function decodeEntities(s) {
  // robust decoder for multi-layer encodings

  let out = String(s || "");

  const reps = [
    [/&amp;amp;amp;amp;amp;/g, "&"],

    [/&amp;amp;amp;amp;lt;/g, "<"],
    [/&amp;amp;amp;amp;gt;/g, ">"],

    [/&amp;amp;amp;amp;#39;/g, "'"],
    [/&amp;amp;amp;amp;quot;/g, '"'],

    [/&amp;amp;amp;lt;/g, "<"],
    [/&amp;amp;amp;gt;/g, ">"],

    [/&amp;amp;amp;#39;/g, "'"],
    [/&amp;amp;amp;quot;/g, '"'],
    [/&amp;amp;amp;/g, "&"],

    [/&amp;amp;lt;/g, "<"],
    [/&amp;amp;gt;/g, ">"],

    [/&amp;amp;#39;/g, "'"],
    [/&amp;amp;quot;/g, '"'],
    [/&amp;amp;/g, "&"],
  ];

  for (const [re, to] of reps) out = out.replace(re, to);

  return out;
}

// Split at semicolons and clean

function normalizeAndSplitStatements(sqlCandidates) {
  const out = [];

  for (const raw of sqlCandidates || []) {
    const decoded = decodeEntities(raw);

    const parts = decoded
      .split(/;+/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const part of parts) {
      if (!looksSql(part)) continue;

      const clean = part.replace(/--.*$/gm, "").trim();

      out.push({ raw, clean });
    }
  }

  const seen = new Set();

  return out.filter((p) =>
    seen.has(p.clean) ? false : (seen.add(p.clean), true),
  );
}

function extractSqlFromAnswerText(text) {
  if (!text) return "";

  const fence = /```sql\s*([\s\S]*?)```/i.exec(text);

  if (fence?.[1]) return fence[1].trim();

  const m = /(with|select)\b[\s\S]+/i.exec(text);

  return m ? m[0].trim() : "";
}

function stripTrailingSemicolons(sql) {
  return String(sql || "").replace(/;+\s*$/, "");
}

function looksIncomplete(sql) {
  if (!sql) return true;

  const s = stripTrailingSemicolons(sql).trim();

  if (/^(with|where|and|or|order by|group by)\b\s*$/i.test(s)) return true;

  if (/^\s*(select|with)\b/i.test(s) && !/\bfrom\b/i.test(s)) return true;

  if ((s.match(/'/g) || []).length % 2 !== 0) return true;

  return false;
}

// Auto chart generator (prefers revenue-like keys when present)

function buildAutoChartSpec(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;

  const keys = Object.keys(rows[0]);

  const numericKeys = keys.filter((k) => typeof rows[0][k] === "number");

  const timeKey = keys.find((k) => /year|month|date|week|quarter/i.test(k));

  // Prefer a revenue-like yKey

  const preferred = [
    "TOTAL_REVENUE",
    "MAX_REVENUE",
    "REVENUE",
    "AVG_DAILY_REVENUE",
    "AMOUNT",
    "VALUE",
    "DATA_POINTS",
  ];

  const yKey = preferred.find((k) => keys.includes(k)) || numericKeys[0];

  if (timeKey && yKey) {
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",

      description: `Auto chart of ${yKey} by ${timeKey}`,

      data: { values: rows },

      mark: "line",

      encoding: {
        x: { field: timeKey, type: "ordinal" },

        y: { field: yKey, type: "quantitative" },
      },

      width: 800,
      height: 400,
    };
  }

  if (rows.length === 1 && numericKeys.length) {
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",

      description: "Single value chart",

      data: {
        values: [{ label: "Total", value: Number(rows[0][numericKeys[0]]) }],
      },

      mark: "bar",

      encoding: {
        x: { field: "label", type: "nominal" },

        y: { field: "value", type: "quantitative" },
      },

      width: 300,
      height: 200,
    };
  }

  return null;
}

// Non-SSE fallback

function extractFromNonStreamingResponse(json) {
  if (!json) return { answerText: "", sql: "" };

  if (json.messages && Array.isArray(json.messages)) {
    const last = json.messages[json.messages.length - 1] || {};

    let answerText = "",
      sql = "";

    for (const part of last.content || []) {
      if (part.type === "text") answerText += part.text || "";

      if (part.type === "json" && !sql) sql = findSql(part.json) || "";
    }

    return { answerText, sql };
  }

  return { answerText: "", sql: "" };
}

// ------------------------

// NEW: extract hallucinated Query ID

// ------------------------

function extractQueryIdFromText(text) {
  const re = /\b(?:Query\s*ID|QueryID|query_id)\s*[:=]\s*([0-9a-fA-F-]{16,})\b/;

  const m = re.exec(String(text || ""));

  return m?.[1] || "";
}

/* ========================= NEW HELPERS ========================= */

// Remove tool-chatter & duplicate paragraphs

function cleanAgentText(text) {
  if (!text) return "";

  const decoded = decodeEntities(text);

  // Lines to drop (agent run-step chatter + tool chatter)

  const noisePatterns = [
    // Generic orchestration/status lines

    /^Choosing data sources to use.*$/i,

    /^Getting additional context.*$/i,

    /^Running .*$/i,

    /^Streaming SQL.*$/i,

    /^Interpreting question.*$/i,

    /^Generating SQL.*$/i,

    /^Postprocessing SQL.*$/i,

    /^Executing SQL.*$/i,

    /^Reviewing the results.*$/i,

    /^Rethinking the plan.*$/i,

    /^Planning the next steps.*$/i,

    /^Done.*$/i,

    /^Executing tool .*$/i,

    /^Forming the answer.*$/i,

    // REMOVE TOOL EXECUTION / ORCHESTRATION NOISE

    /^.*\btool_use_id\b.*$/i,

    /^.*\btool_result_id\b.*$/i,

    /^.*\btool result\b.*$/i,

    /^.*\btoolu_[a-z0-9_]+\b.*$/i,

    /^.*\bdata_to_chart\b.*$/i,

    /^.*\bCURRENT_QUERY_ID\b.*$/i,

    /^.*\bRevenue_data tool\b.*$/i,

    /^.*\bCall Revenue_data\b.*$/i,

    /^.*\bCall data_to_chart\b.*$/i,

    /^.*\bPresent the answer\b.*$/i,

    // Noisy single-line PLAN headers (keep actual steps if present)

    /^PLAN:\s*$/i,
  ];

  const lines = decoded.split(/\r?\n/);

  const filteredLines = lines.filter(
    (ln) => !noisePatterns.some((re) => re.test(ln.trim())),
  );

  // De-duplicate repeated planning blocks

  const joined = filteredLines.join("\n");

  const blocks = joined

    .split(/\n{2,}/)

    .map((b) => b.trim())

    .filter(Boolean);

  const seen = new Set();

  const uniqueBlocks = [];

  for (const b of blocks) {
    const key = b.replace(/\s+/g, " ").toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);

      uniqueBlocks.push(b);
    }
  }

  return uniqueBlocks.join("\n\n").trim();
}

// Remove any inline "Query ID: xyz" from text

function removeQueryId(text) {
  if (!text) return text;

  return text

    .replace(/[*_`]*Query ID[*_`]*\s*:\s*`?[0-9a-fA-F-]{16,}`?/gi, "")

    .replace(/\n{2,}/g, "\n\n")

    .trim();
}

// Split planning vs. final answer at the earliest final marker

function splitPlanningAndFinal(answerText) {
  const markers = [
    /^##\s+Final Answer\b/im,

    /^##\s+Total Revenue\b/im,

    /^##\s+Maximum Revenue\b/im, // match "## Maximum Revenue by Month"

    /^##\s+Answer\b/im,

    /^###\s+Key Insights\b/im,
  ];

  let idx = -1;

  for (const re of markers) {
    const m = re.exec(answerText);

    if (m && (idx === -1 || m.index < idx)) idx = m.index;
  }

  if (idx === -1) {
    return { planningText: answerText.trim(), finalAnswerText: "" };
  }

  return {
    planningText: answerText.slice(0, idx).trim(),

    finalAnswerText: answerText.slice(idx).trim(),
  };
}

// Extract bullets from Key Insights section (supports "### Key Insights" and "**Key Insights:**")

function extractKeyInsights(markdown) {
  if (!markdown)
    return {
      keyInsights: [],
      insightsMarkdown: "",
      removedText: markdown || "",
    };

  // Primary: "### Key Insights"

  let startMatch = /(^|\n)###\s+Key Insights\s*:?\s*\n/i.exec(markdown);

  let startIdx = -1;

  if (startMatch) {
    startIdx =
      startMatch.index +
      (startMatch[1] ? startMatch[1].length : 0) +
      startMatch[0].length;
  } else {
    // Fallback: "**Key Insights:**"

    const boldMatch = /(^|\n)\*\*Key Insights\*\*:?/i.exec(markdown);

    if (boldMatch) {
      startIdx =
        boldMatch.index +
        (boldMatch[1] ? boldMatch[1].length : 0) +
        boldMatch[0].length;
    }
  }

  if (startIdx < 0) {
    return { keyInsights: [], insightsMarkdown: "", removedText: markdown };
  }

  const tail = markdown.slice(startIdx);

  // End at next heading

  const endMatch = /\n##\s+|\n###\s+/i.exec(tail);

  const section = endMatch ? tail.slice(0, endMatch.index) : tail;

  // Extract bullets

  const bullets = section

    .split(/\r?\n/)

    .map((l) => l.trim())

    .filter((l) => /^(-|\*|•)\s+/.test(l))

    .map((l) => l.replace(/^(-|\*|•)\s+/, "").trim());

  // Remove the identified section from the original markdown

  const prefix = markdown.slice(0, startIdx);

  const suffix = endMatch ? tail.slice(endMatch.index) : "";

  const removedText = (prefix + suffix).trim();

  return {
    keyInsights: bullets,
    insightsMarkdown: section.trim(),
    removedText,
  };
}

/* ========================= OPTION B: AUTO-GENERATED INSIGHTS ========================= */

function getMeasureKey(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";

  const keys = Object.keys(rows[0]);

  const preferred = [
    "TOTAL_REVENUE",
    "MAX_REVENUE",
    "REVENUE",
    "AVG_DAILY_REVENUE",
    "SUM_REVENUE",
    "AMOUNT",
    "VALUE",
  ];

  for (const k of preferred) if (keys.includes(k)) return k;

  // fallback: first numeric column

  const numeric = keys.find((k) => typeof rows[0][k] === "number");

  return numeric || "";
}

function getTimeKey(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";

  const keys = Object.keys(rows[0]);

  const candidates = [
    "MONTH",
    "DATE",
    "DAY",
    "YEAR",
    "WEEK",
    "QUARTER",
    "TIME",
    "TIMESTAMP",
  ];

  for (const c of candidates) if (keys.includes(c)) return c;

  // fallback: first field that looks like date string

  return keys.find((k) => /month|date|year|week|quarter|time/i.test(k)) || "";
}

function parseDateLike(v) {
  if (v == null) return null;

  if (v instanceof Date) return v;

  const s = String(v);

  // Common forms: "2024-11-01", "2024/11/01", "Nov 2024", etc.

  const d = new Date(s);

  return isNaN(d.getTime()) ? null : d;
}

function fmtMoney(n) {
  if (typeof n !== "number" || !isFinite(n)) return String(n);

  // Use USD-style formatting; adjust if you want locale-aware

  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtMonth(d) {
  if (!(d instanceof Date)) return String(d);

  const y = d.getFullYear();

  const m = d.toLocaleString("en-US", { month: "short" });

  return `${m} ${y}`;
}

function generateInsightsFromRows(rows) {
  const insights = [];

  if (!Array.isArray(rows) || !rows.length) return insights;

  const timeKey = getTimeKey(rows);

  const measureKey = getMeasureKey(rows);

  if (!measureKey) return insights;

  // Build simplified array with parsed dates and measure

  const series = rows
    .map((r) => {
      const val = Number(r[measureKey]);

      const td = timeKey ? parseDateLike(r[timeKey]) : null;

      return { raw: r, t: td, v: isFinite(val) ? val : null };
    })
    .filter((x) => x.v != null);

  if (!series.length) return insights;

  // Sort by time if we have it

  const byTime = series.slice().sort((a, b) => {
    if (a.t && b.t) return a.t - b.t;

    return 0;
  });

  const first = byTime[0];

  const last = byTime[byTime.length - 1];

  // Min / Max

  let min = series[0],
    max = series[0];

  for (const s of series) {
    if (s.v < min.v) min = s;

    if (s.v > max.v) max = s;
  }

  // Insight #1: Highest month

  insights.push(
    `Highest ${measureKey.replace(/_/g, " ").toLowerCase()}: ${fmtMoney(max.v)}${max.t ? ` in ${fmtMonth(max.t)}` : ""}`,
  );

  // Insight #2: Lowest month

  insights.push(
    `Lowest ${measureKey.replace(/_/g, " ").toLowerCase()}: ${fmtMoney(min.v)}${min.t ? ` in ${fmtMonth(min.t)}` : ""}`,
  );

  // Insight #3: Range (date range + count)

  if (first && last && first.t && last.t) {
    insights.push(
      `Data range: ${fmtMonth(first.t)} to ${fmtMonth(last.t)} (${byTime.length} months)`,
    );
  } else {
    insights.push(`Data points: ${series.length}`);
  }

  // Insight #4: Trend from first to last (percent change)

  if (first && last && isFinite(first.v) && isFinite(last.v) && first.v !== 0) {
    const delta = last.v - first.v;

    const pct = (delta / Math.abs(first.v)) * 100;

    const sign = pct >= 0 ? "↑" : "↓";

    insights.push(
      `Overall trend: ${sign} ${Math.abs(pct).toFixed(1)}% from first to last month (${fmtMoney(first.v)} → ${fmtMoney(last.v)})`,
    );
  }

  // Optional Insight #5: Typical range (10th to 90th percentile)

  const values = series.map((s) => s.v).sort((a, b) => a - b);

  const q = (p) => {
    const idx = (values.length - 1) * p;

    const lo = Math.floor(idx),
      hi = Math.ceil(idx);

    if (lo === hi) return values[lo];

    return values[lo] + (values[hi] - values[lo]) * (idx - lo);
  };

  if (values.length >= 5) {
    const p10 = q(0.1),
      p90 = q(0.9);

    insights.push(
      `Typical range (10–90th pct): ${fmtMoney(p10)} – ${fmtMoney(p90)}`,
    );
  }

  // Ensure uniqueness and non-empty

  const seen = new Set();

  return insights.filter((x) => {
    const k = x.toLowerCase();

    if (seen.has(k) || !x.trim()) return false;

    seen.add(k);

    return true;
  });
}

/* ====================== MAIN API ROUTE ====================== */

app.post("/api/structured-agent", async (req, res) => {
  try {
    const prompt =
      req.body?.prompt || req.body?.query
        ? `**Follow these rules:**\n\n1. Output must be valid **React Markdown**.\n2. Use proper **bold**, **indentation**, and formatting.\n\n---\n\n**User Prompt:**\n${req.body.prompt || req.body.query}`
        : "";

    if (!prompt)
      return res.status(400).json({ error: "Prompt (or query) is required" });

    if (!AUTH_TOKEN)
      return res.status(500).json({ error: "Missing SNOWFLAKE_AUTH_TOKEN" });

    if (!HOST || !DATABASE || !SCHEMA || !AGENT_STRUCTURED) {
      return res
        .status(500)
        .json({ error: "Missing HOST/DATABASE/SCHEMA/AGENT_STRUCTURED" });
    }

    const url = `https://${HOST}/api/v2/databases/${DATABASE}/schemas/${SCHEMA}/agents/${AGENT_STRUCTURED}:run`;

    const headers = {
      "Content-Type": "application/json",

      Accept: "text/event-stream",

      Authorization: `Bearer ${AUTH_TOKEN}`,
    };

    const body = {
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],

      tool_choice: { type: "auto" },
    };

    const upstream = await axios.post(url, body, {
      headers,

      responseType: "stream",

      timeout: 60000,

      validateStatus: (s) => s < 500,
    });

    if (upstream.status >= 400) {
      let txt = "";

      for await (const chunk of upstream.data) txt += chunk.toString("utf-8");

      return res.status(upstream.status).json({
        error: `Upstream ${upstream.status}`,

        details: tryJson(txt) ?? txt,
      });
    }

    const ctype = String(
      upstream.headers?.["content-type"] || "",
    ).toLowerCase();

    // Accumulator (used for BOTH SSE and non-SSE)

    const acc = { answerText: "", sqlCandidates: [] };

    if (!ctype.includes("text/event-stream")) {
      // Non-SSE fallback (no early return — we still clean/split later)

      let fallback = "";

      for await (const chunk of upstream.data)
        fallback += chunk.toString("utf-8");

      const parsed = tryJson(fallback);

      const { answerText, sql } = extractFromNonStreamingResponse(parsed);

      acc.answerText = answerText || "";

      if (sql) acc.sqlCandidates.push(sql);
    } else {
      // ------------------ SSE PARSING ------------------

      let buf = "";

      let currentEvent = null;

      let dataBuf = "";

      const flush = () => {
        if (!dataBuf) return;

        const payload = tryJson(dataBuf.trim());

        if (payload) processSseEvent(currentEvent, payload, acc);

        dataBuf = "";
      };

      await new Promise((resolve, reject) => {
        upstream.data.on("data", (chunk) => {
          buf += chunk.toString("utf-8");

          let nl;

          while ((nl = buf.indexOf("\n")) >= 0) {
            let line = buf.slice(0, nl).replace(/\r$/, "");

            buf = buf.slice(nl + 1);

            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
              continue;
            }

            if (line.startsWith("data:")) {
              dataBuf += line.slice(5).trimStart();
              continue;
            }

            if (line.trim() === "") {
              flush();
              currentEvent = null;
            }
          }
        });

        upstream.data.on("end", () => {
          flush();
          resolve();
        });

        upstream.data.on("error", reject);
      });
    }

    // SQL block inside answer text

    const fenced = extractSqlFromAnswerText(acc.answerText);

    if (fenced) acc.sqlCandidates.push(fenced);

    // ------------------ SQL Extraction ------------------

    const normalizedCandidates = normalizeAndSplitStatements(acc.sqlCandidates);

    let rows = [];

    let finalSql = "";

    let executionError = null;

    let verifiedQueryId = null;

    const allowExecution = req.body?.allowExecution !== false;

    if (allowExecution && normalizedCandidates.length) {
      for (let i = normalizedCandidates.length - 1; i >= 0; i--) {
        const candidate = normalizedCandidates[i];

        if (!candidate.clean || looksIncomplete(candidate.clean)) continue;

        try {
          const { rows: r, stmt } = await new Promise((resolve, reject) => {
            connection.execute({
              sqlText: candidate.clean,

              complete: (err, stmt, resRows) => {
                if (err) return reject(err);

                resolve({ rows: Array.isArray(resRows) ? resRows : [], stmt });
              },
            });
          });

          finalSql = candidate.clean;

          rows = r;

          verifiedQueryId = stmt?.getStatementId?.() || null;

          if (rows.length > 0) break;
        } catch (err) {
          executionError = err?.message || String(err);
        }
      }
    } else if (normalizedCandidates.length) {
      const last = normalizedCandidates[normalizedCandidates.length - 1];

      finalSql = last.clean;
    }

    // ------------------ extract hallucinated Query ID ------------------

    const unverifiedAgentQueryId = extractQueryIdFromText(acc.answerText) || "";

    // ------------------ Chart ------------------

    let chartSpec = null;

    if (
      Array.isArray(rows) &&
      rows.length &&
      req.body?.includeChartSpec !== false
    ) {
      chartSpec = buildAutoChartSpec(rows);
    }

    // ------------------ CLEAN + SPLIT + EXTRACT / GENERATE INSIGHTS ------------------

    const cleanedText = cleanAgentText(acc.answerText);

    // Separate planning vs. final (we won't return final text)

    let { planningText, finalAnswerText } = splitPlanningAndFinal(cleanedText);

    // Remove inline Query ID mentions

    planningText = removeQueryId(planningText);

    finalAnswerText = removeQueryId(finalAnswerText);

    // Try to extract insights from agent text

    let insightsSource = finalAnswerText || cleanedText;

    let { keyInsights, insightsMarkdown } = extractKeyInsights(insightsSource);

    // If insights were found inside planning (when no final section), also strip them from planning

    if ((!finalAnswerText || !keyInsights.length) && planningText) {
      const tmp = extractKeyInsights(planningText);

      if (tmp.keyInsights.length && !keyInsights.length) {
        keyInsights = tmp.keyInsights;
      }
    }

    // >>> OPTION B: Auto-generate insights from rows if still empty <<<

    if (
      (!keyInsights || !keyInsights.length) &&
      Array.isArray(rows) &&
      rows.length
    ) {
      keyInsights = generateInsightsFromRows(rows);
    }

    // ------------------ RESPONSE (only the fields you requested) ------------------

    return res.json({
      agent: AGENT_STRUCTURED,

      planningText: planningText || "",

      keyInsights, // array (extracted or auto-generated from rows)

      sql: finalSql || "",

      rows,

      chartSpec,

      queryId: verifiedQueryId || unverifiedAgentQueryId || null,

      queryIdVerified: Boolean(verifiedQueryId),

      // No answerText / finalAnswerText returned per your requirement

      error: executionError || undefined,
    });
  } catch (err) {
    console.error("structured-agent error:", err);
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });

    return res.status(500).json({ error: err?.message || String(err) });
  }
});

const LINEAGE_AGENT_NAME = "LINEAGE360";

app.post("/api/lineage-agent", async (req, res) => {
  try {
    const rawPrompt = req.body?.prompt || req.body?.query || "";
    if (!rawPrompt.trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!AUTH_TOKEN) {
      return res.status(500).json({ error: "Missing SNOWFLAKE_AUTH_TOKEN" });
    }

    const prompt = `**You are a data lineage expert. Follow these rules:**\n\n` +
      `1. Use SNOWFLAKE.CORE.GET_LINEAGE() to trace data flows.\n` +
      `2. Check R_EXTERNAL_LINEAGE_SOURCES for external connections.\n` +
      `3. Present results in structured React Markdown format.\n` +
      `4. Group results by database for cross-DB visibility.\n` +
      `5. Highlight external sources (S3, Postgres, Kafka, etc.) distinctly.\n\n` +
      `---\n\n**User Question:**\n${rawPrompt}`;

    const url = `https://${HOST}/api/v2/databases/${DATABASE}/schemas/${SCHEMA}/agents/${LINEAGE_AGENT_NAME}:run`;
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    };

    const body = {
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      tool_choice: { type: "auto" },
    };

    const upstream = await axios.post(url, body, {
      headers,
      responseType: "stream",
      timeout: 60000,
      validateStatus: (s) => s < 500,
    });

    if (upstream.status >= 400) {
      let txt = "";
      for await (const chunk of upstream.data) txt += chunk.toString("utf-8");
      return res.status(upstream.status).json({
        error: `Upstream ${upstream.status}`,
        details: tryJson(txt) ?? txt,
      });
    }

    const acc = { answerText: "", sqlCandidates: [] };
    const ctype = String(upstream.headers?.["content-type"] || "").toLowerCase();

    if (!ctype.includes("text/event-stream")) {
      let fallback = "";
      for await (const chunk of upstream.data) fallback += chunk.toString("utf-8");
      const parsed = tryJson(fallback);
      acc.answerText = parsed?.messages?.[parsed.messages.length - 1]?.content?.[0]?.text || fallback;
    } else {
      let buf = "";
      let currentEvent = null;
      let dataBuf = "";

      const flush = () => {
        if (!dataBuf) return;
        const payload = tryJson(dataBuf.trim());
        if (payload) processSseEvent(currentEvent, payload, acc);
        dataBuf = "";
      };

      await new Promise((resolve, reject) => {
        upstream.data.on("data", (chunk) => {
          buf += chunk.toString("utf-8");
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            let line = buf.slice(0, nl).replace(/\r$/, "");
            buf = buf.slice(nl + 1);
            if (line.startsWith("event:")) { currentEvent = line.slice(6).trim(); continue; }
            if (line.startsWith("data:")) { dataBuf += line.slice(5).trimStart(); continue; }
            if (line.trim() === "") { flush(); currentEvent = null; }
          }
        });
        upstream.data.on("end", () => { flush(); resolve(); });
        upstream.data.on("error", reject);
      });
    }

    let rows = [];
    let finalSql = "";
    const fenced = extractSqlFromAnswerText(acc.answerText);
    if (fenced) acc.sqlCandidates.push(fenced);
    const normalizedCandidates = normalizeAndSplitStatements(acc.sqlCandidates);

    if (normalizedCandidates.length) {
      for (let i = normalizedCandidates.length - 1; i >= 0; i--) {
        const candidate = normalizedCandidates[i];
        if (!candidate.clean || looksIncomplete(candidate.clean)) continue;
        try {
          const { rows: r } = await new Promise((resolve, reject) => {
            connection.execute({
              sqlText: candidate.clean,
              complete: (err, stmt, resRows) => {
                if (err) return reject(err);
                resolve({ rows: Array.isArray(resRows) ? resRows : [], stmt });
              },
            });
          });
          finalSql = candidate.clean;
          rows = r;
          if (rows.length > 0) break;
        } catch (err) { /* skip failed candidates */ }
      }
    }

    const cleanedText = cleanAgentText(acc.answerText);

    return res.json({
      agent: LINEAGE_AGENT_NAME,
      answerText: cleanedText,
      sql: finalSql || "",
      rows,
    });
  } catch (err) {
    console.error("lineage-agent error:", err);
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

//to save chatbot responses
// -----------------------------
// Helper: resolve response_id of last inserted matching row
// -----------------------------
function selectResponseId({ chatbot_id, model_name, question, answer }, cb) {
  const sql = `
    SELECT response_id
    FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_CHATBOT_RESPONSE_TBL
    WHERE chatbot_id = ? 
      AND model_name = ?
      AND question = ?
      AND response = ?
    ORDER BY start_time DESC
    LIMIT 1
  `;
  connection.execute({
    sqlText: sql,
    binds: [
      Number(chatbot_id),
      String(model_name),
      String(question),
      String(answer),
    ],
    complete: (err, _stmt, rows) => {
      if (err) return cb(err);
      const rid =
        rows && rows[0]
          ? Number(rows[0].RESPONSE_ID ?? rows[0].response_id)
          : null;
      cb(null, rid);
    },
  });
}

// -----------------------------
// POST /api/chatbot-response
// Captures user_id exactly as caller passes it; returns response_id
// -----------------------------
// POST /api/chatbot-response

// app.post("/api/chatbot-response", (req, res) => {
//   const {
//     chatbot_id,
//     model_name,
//     question,
//     response: answer,
//     thinkingdesc,   // stays as you wrote
//     token_count,
//     user_id         // can be null
//   } = req.body;

//   // Required fields
//   if (!chatbot_id || !model_name || !question || !answer) {
//     return res.status(400).json({
//       success: false,
//       error: "chatbot_id, model_name, question, and response are required",
//       message: "Please provide all required fields."
//     });
//   }

//   console.log("[RESP] body.user_id:", user_id, "typeof:", typeof user_id);

//   const uidNum = user_id == null ? null : Number(user_id);
//   const thinkingVal = thinkingdesc == null ? null : String(thinkingdesc);
//   const tokenVal = token_count == null ? null : Number(token_count);

//   // ✅ FINAL FIX: Correct parameter order matching SP
//   const callSql =
//     `CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_sp_save_chatbot_response(?, ?, ?, ?, ?, ?, ?)`;

//   connection.execute({
//     sqlText: callSql,
//     binds: [
//       Number(chatbot_id),   // 1 chatbot_id
//       String(model_name),   // 2 model_name
//       String(question),     // 3 question
//       String(answer),       // 4 response
//       thinkingVal,          // 5 thinkingdesc
//       tokenVal,             // 6 token_count
//       uidNum                // 7 user_id
//     ],
//     complete: (err) => {
//       if (err) {
//         console.error("Error executing R_sp_save_chatbot_response:", err);
//         return res.status(500).json({
//           success: false,
//           error: "Failed to save chatbot response",
//           message: err?.message
//         });
//       }

//       // Select the inserted record
//       const resolveSql = `
//         SELECT response_id, user_id, thinkingdesc
//         FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_CHATBOT_RESPONSE_TBL
//         WHERE chatbot_id = ? AND model_name = ? AND question = ? AND response = ?
//         ORDER BY start_time DESC
//         LIMIT 1
//       `;

//       connection.execute({
//         sqlText: resolveSql,
//         binds: [
//           Number(chatbot_id),
//           String(model_name),
//           String(question),
//           String(answer)
//         ],
//         complete: (e2, _stmt2, rows2) => {
//           if (e2) {
//             console.error("Resolve response_id failed:", e2);
//             return res.status(500).json({
//               success: false,
//               error: "Saved but failed to resolve response_id",
//               message: e2?.message
//             });
//           }

//           const row = rows2 && rows2[0] ? rows2[0] : null;
//           const rid = row ? Number(row.RESPONSE_ID ?? row.response_id ?? null) : null;
//           const storedUid = row ? (row.USER_ID ?? row.user_id ?? null) : null;
//           const storedThinking = row ? (row.THINKINGDESC ?? row.thinkingdesc ?? null) : null;

//           console.log("[RESP] user_id_sent:", uidNum, "user_id_stored_in_DB:", storedUid);
//           console.log("[RESP] thinkingdesc_sent:", thinkingVal, "thinkingdesc_stored_in_DB:", storedThinking);

//           return res.json({
//             success: true,
//             data: {
//               status: "OK",
//               response_id: rid ?? null,
//               user_id_sent: uidNum,
//               user_id_stored: storedUid,
//               thinkingdesc_sent: thinkingVal,
//               thinkingdesc_stored: storedThinking
//             }
//           });
//         }
//       });
//     }
//   });
// });

// app.post("/api/chatbot-response", (req, res) => {
//   const {
//     chatbot_id,
//     model_name,
//     question,
//     response: answer,
//     thinkingdesc,   // stays as you wrote
//     token_count,
//     user_id         // can be null
//   } = req.body;

//   // Required fields
//   if (!chatbot_id || !model_name || !question || !answer) {
//     return res.status(400).json({
//       success: false,
//       error: "chatbot_id, model_name, question, and response are required",
//       message: "Please provide all required fields."
//     });
//   }

//   console.log("[RESP] body.user_id:", user_id, "typeof:", typeof user_id);

//   const uidNum = user_id == null ? null : Number(user_id);
//   const thinkingVal = thinkingdesc == null ? null : String(thinkingdesc);
//   const tokenVal = token_count == null ? null : Number(token_count);

//   // ✅ FINAL FIX: Correct parameter order matching SP
//   const callSql =
//     `CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_sp_save_chatbot_response(?, ?, ?, ?, ?, ?, ?)`;

//   connection.execute({
//     sqlText: callSql,
//     binds: [
//       Number(chatbot_id),   // 1 chatbot_id
//       String(model_name),   // 2 model_name
//       String(question),     // 3 question
//       String(answer),       // 4 response
//       thinkingVal,          // 5 thinkingdesc
//       tokenVal,             // 6 token_count
//       uidNum                // 7 user_id
//     ],
//     complete: (err) => {
//       if (err) {
//         console.error("Error executing R_sp_save_chatbot_response:", err);
//         return res.status(500).json({
//           success: false,
//           error: "Failed to save chatbot response",
//           message: err?.message
//         });
//       }

//       // Select the inserted record
//       const resolveSql = `
//         SELECT response_id, user_id, thinkingdesc
//         FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_CHATBOT_RESPONSE_TBL
//         WHERE chatbot_id = ? AND model_name = ? AND question = ? AND response = ?
//         ORDER BY start_time DESC
//         LIMIT 1
//       `;

//       connection.execute({
//         sqlText: resolveSql,
//         binds: [
//           Number(chatbot_id),
//           String(model_name),
//           String(question),
//           String(answer)
//         ],
//         complete: (e2, _stmt2, rows2) => {
//           if (e2) {
//             console.error("Resolve response_id failed:", e2);
//             return res.status(500).json({
//               success: false,
//               error: "Saved but failed to resolve response_id",
//               message: e2?.message
//             });
//           }

//           const row = rows2 && rows2[0] ? rows2[0] : null;
//           const rid = row ? Number(row.RESPONSE_ID ?? row.response_id ?? null) : null;
//           const storedUid = row ? (row.USER_ID ?? row.user_id ?? null) : null;
//           const storedThinking = row ? (row.THINKINGDESC ?? row.thinkingdesc ?? null) : null;

//           console.log("[RESP] user_id_sent:", uidNum, "user_id_stored_in_DB:", storedUid);
//           console.log("[RESP] thinkingdesc_sent:", thinkingVal, "thinkingdesc_stored_in_DB:", storedThinking);

//           return res.json({
//             success: true,
//             data: {
//               status: "OK",
//               response_id: rid ?? null,
//               user_id_sent: uidNum,
//               user_id_stored: storedUid,
//               thinkingdesc_sent: thinkingVal,
//               thinkingdesc_stored: storedThinking
//             }
//           });
//         }
//       });
//     }
//   });
// });

// app.post('/api/chatbot-response', (req, res) => {
//   const {
//     chatbot_id,
//     model_name,
//     question,
//     response: answer,
//     token_count,
//     user_id,
//     thinkingdesc
//   } = req.body;

//   // 1) Validate required fields
//   if (!chatbot_id || !model_name || !question || !answer) {
//     return res.status(400).json({
//       success: false,
//       error: 'chatbot_id, model_name, question, and response are required',
//       message: 'Please provide all required fields.'
//     });
//   }

//   // 2) Normalize input types
//   const chatbotIdNum = Number(chatbot_id);
//   const modelNameStr = String(model_name);
//   const questionStr = String(question);
//   const answerStr = String(answer);
//   const uidNum = user_id == null ? null : Number(user_id);
//   const thinkingVal = thinkingdesc == null ? null : String(thinkingdesc);
//   const tokenVal = token_count == null ? null : Number(token_count);

//   if (
//     Number.isNaN(chatbotIdNum) ||
//     (uidNum !== null && Number.isNaN(uidNum)) ||
//     (tokenVal !== null && Number.isNaN(tokenVal))
//   ) {
//     return res.status(400).json({
//       success: false,
//       error: 'Invalid number in chatbot_id / user_id / token_count',
//       message: 'Provide valid numeric values.'
//     });
//   }

//   // 3) Call the stored procedure
//   // IMPORTANT: Order now matches typical SP signature:
//   // (chatbot_id, model_name, question, response, token_count, user_id, thinkingdesc)
//   // Extra safety: explicit casts to expected types.
//   const callSql = `
//     CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_SP_SAVE_CHATBOT_RESPONSE(
//       TO_NUMBER(?),      -- chatbot_id
//       TO_VARCHAR(?),     -- model_name
//       TO_VARCHAR(?),     -- question
//       TO_VARCHAR(?),     -- response
//       TO_NUMBER(?),      -- token_count
//       TO_NUMBER(?),      -- user_id
//       TO_VARCHAR(?)      -- thinkingdesc
//     )
//   `;

//   const callBinds = [
//     chatbotIdNum,
//     modelNameStr,
//     questionStr,
//     answerStr,
//     tokenVal,
//     uidNum,
//     thinkingVal
//   ];

//   connection.execute({
//     sqlText: callSql,
//     binds: callBinds,
//     complete: (err) => {
//       if (err) {
//         console.error('Error executing save response SP:', err);
//         return res.status(500).json({
//           success: false,
//           error: 'Failed to save chatbot response',
//           message: err?.message
//         });
//       }

//       // 4) Resolve RESPONSE_ID (recency guard)
//       const resolveSql = `
//         SELECT RESPONSE_ID, USER_ID, THINKINGDESC
//         FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_CHATBOT_RESPONSE_TBL
//         WHERE CHATBOT_ID = ?
//           AND MODEL_NAME = ?
//           AND QUESTION = ?
//           AND RESPONSE = ?
//           AND CREATED_AT >= DATEADD(second, -5, CURRENT_TIMESTAMP())
//         ORDER BY START_TIME DESC
//         LIMIT 1
//       `;

//       const resolveBinds = [chatbotIdNum, modelNameStr, questionStr, answerStr];

//       connection.execute({
//         sqlText: resolveSql,
//         binds: resolveBinds,
//         complete: (e2, _stmt2, rows2) => {
//           if (e2) {
//             console.error('Resolve response_id failed:', e2);
//             return res.status(500).json({
//               success: false,
//               error: 'Saved but failed to resolve response_id',
//               message: e2?.message
//             });
//           }

//           const row = rows2?.[0] || null;
//           const responseId =
//             row?.RESPONSE_ID ??
//             row?.response_id ??
//             (row ? Object.values(row)[0] : null);

//           return res.json({
//             success: true,
//             data: {
//               status: 'OK',
//               response_id: responseId,
//               user_id_sent: uidNum,
//               user_id_stored: row?.USER_ID ?? row?.user_id ?? null,
//               thinkingdesc_sent: thinkingVal,
//               thinkingdesc_stored: row?.THINKINGDESC ?? row?.thinkingdesc ?? null
//             }
//           });
//         }
//       });
//     }
//   });
// });
// ``

// -------------------------
// POST /api/chatbot-response
// -------------------------
const badRequest = (res, message, details) =>
  res.status(400).json({ error: message, details });

app.post("/api/chatbot-response", (req, res) => {
  const startedAt = Date.now();

  const {
    chatbot_id,
    model_name,
    question,
    response: answer,
    token_count,
    user_id,
    thinkingdesc,

    // Client may send either structured object or separate fields:
    sqlDetails,
    sqlText,
    queryId,
    queryIdVerified,
  } = req.body || {};

  // --- 1) Validate requireds ---
  if (
    chatbot_id == null ||
    model_name == null ||
    question == null ||
    answer == null
  ) {
    return badRequest(
      res,
      "Please provide all required fields: chatbot_id, model_name, question, response",
      "chatbot_id, model_name, question, and response are required",
    );
  }

  // --- 2) Normalize input types ---
  const chatbotIdNum = Number(chatbot_id);
  const modelNameStr = String(model_name);
  const questionStr = String(question);
  const answerStr = String(answer);
  const uidNum = user_id == null ? null : Number(user_id);
  const thinkingVal = thinkingdesc == null ? null : String(thinkingdesc);
  const tokenVal = token_count == null ? null : Number(token_count);

  if (
    Number.isNaN(chatbotIdNum) ||
    (uidNum !== null && Number.isNaN(uidNum)) ||
    (tokenVal !== null && Number.isNaN(tokenVal))
  ) {
    return badRequest(
      res,
      "Provide valid numeric values for chatbot_id / user_id / token_count",
      "Invalid number",
    );
  }

  // --- 3) Build SQL_DETAILS JSON string (optional) ---
  let sqlDetailsObj = null;
  if (sqlDetails && typeof sqlDetails === "object") {
    sqlDetailsObj = sqlDetails;
  } else if (sqlText || queryId || typeof queryIdVerified === "boolean") {
    sqlDetailsObj = {
      sql: sqlText ?? null,
      queryId: queryId ?? null,
      queryIdVerified: queryIdVerified === true,
    };
  }

  let sqlDetailsStr = null;
  if (sqlDetailsObj) {
    try {
      sqlDetailsStr = JSON.stringify(sqlDetailsObj);
      if (sqlDetailsStr.length > 1000000) {
        sqlDetailsStr = sqlDetailsStr.slice(0, 1000000);
      }
    } catch (jsonErr) {
      console.warn(
        "[chatbot-response] Failed to stringify sqlDetails",
        jsonErr,
      );
      sqlDetailsStr = null;
    }
  }

  // --- 4) Size caps for text columns ---
  const MAX_STR = 20000;
  if (modelNameStr.length > 512) {
    return badRequest(res, "model_name too long");
  }
  if (
    questionStr.length > MAX_STR ||
    answerStr.length > MAX_STR ||
    (thinkingVal && thinkingVal.length > MAX_STR)
  ) {
    return badRequest(
      res,
      "question/response/thinkingdesc exceed allowed size",
    );
  }

  // Helper to run a SQL and return a Promise for easier flow
  const execAsync = (sqlText, binds) =>
    new Promise((resolve, reject) => {
      connection.execute({
        sqlText,
        binds,
        complete: (err, stmt, rows) => {
          if (err) return reject(err);
          resolve({ stmt, rows });
        },
      });
    });

  // Set a short query tag and reasonable timeout for this request
  const setSessionParams = async () => {
    try {
      await execAsync(
        `ALTER SESSION SET QUERY_TAG = 'chatbot-response:${chatbotIdNum}', STATEMENT_TIMEOUT_IN_SECONDS = 20`,
        [],
      );
    } catch (e) {
      console.warn(
        "[chatbot-response] ALTER SESSION failed (non-fatal):",
        e?.message || e,
      );
    }
  };

  // SP CALL (8 params inc. sql_details)
  const callSql = `
    CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_SP_SAVE_CHATBOT_RESPONSE(
      CAST(? AS NUMBER),  -- chatbot_id
      CAST(? AS STRING),  -- model_name
      CAST(? AS STRING),  -- question
      CAST(? AS STRING),  -- response
      CAST(? AS STRING),  -- thinkingdesc
      CAST(? AS NUMBER),  -- token_count
      CAST(? AS NUMBER),  -- user_id
      CAST(? AS STRING)   -- sql_details (JSON text)
    )
  `;
  const callBinds = [
    chatbotIdNum,
    modelNameStr,
    questionStr,
    answerStr,
    thinkingVal,
    tokenVal,
    uidNum,
    sqlDetailsStr,
  ];

  // Fallback direct INSERT (no Python SP)
  const directInsertSql = `
    INSERT INTO D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_CHATBOT_RESPONSE_TBL
      (CHATBOT_ID, MODEL_NAME, QUESTION, RESPONSE, THINKINGDESC, TOKEN_COUNT, USER_ID, SQL_DETAILS, START_TIME, END_TIME, CREATED_AT)
    SELECT
      ?, ?, ?, ?, ?, ?, ?, PARSE_JSON(?), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  `;
  const directInsertBinds = [
    chatbotIdNum,
    modelNameStr,
    questionStr,
    answerStr,
    thinkingVal,
    tokenVal,
    uidNum,
    sqlDetailsStr,
  ];

  // Resolve query (slightly longer window for safety)
  const resolveSql = `
    SELECT RESPONSE_ID, USER_ID, THINKINGDESC
    FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_CHATBOT_RESPONSE_TBL
    WHERE CHATBOT_ID = ?
      AND MODEL_NAME = ?
      AND QUESTION = ?
      AND RESPONSE = ?
      AND CREATED_AT >= DATEADD(second, -10, CURRENT_TIMESTAMP())
    ORDER BY START_TIME DESC
    LIMIT 1
  `;
  const resolveBinds = [chatbotIdNum, modelNameStr, questionStr, answerStr];

  (async () => {
    try {
      console.info("[chatbot-response] ENTER", {
        chatbotIdNum,
        hasSqlDetails: Boolean(sqlDetailsStr),
        lenQuestion: questionStr.length,
        lenResponse: answerStr.length,
        lenThinking: thinkingVal?.length || 0,
      });

      await setSessionParams();

      // Try SP first
      try {
        console.info(
          "[chatbot-response] Calling SP R_SP_SAVE_CHATBOT_RESPONSE",
        );
        await execAsync(callSql, callBinds);
        console.info("[chatbot-response] SP call succeeded");
      } catch (spErr) {
        console.error(
          "[chatbot-response] SP call failed, falling back to direct INSERT:",
          spErr?.message || spErr,
        );
        // Fallback: direct INSERT (no SP cold start)
        await execAsync(directInsertSql, directInsertBinds);
        console.info("[chatbot-response] Direct INSERT succeeded");
      }

      // Resolve response_id
      console.info("[chatbot-response] Resolving response_id...");
      const { rows: rows2 } = await execAsync(resolveSql, resolveBinds);
      const row = Array.isArray(rows2) && rows2.length ? rows2[0] : null;
      const responseId =
        row?.RESPONSE_ID ??
        row?.response_id ??
        (row ? Object.values(row)[0] : null);

      const payload = {
        success: true,
        data: [
          {
            status: "OK",
            response_id: responseId,
            user_id_sent: uidNum,
            user_id_stored: row?.USER_ID ?? row?.user_id ?? null,
            thinkingdesc_sent: thinkingVal,
            thinkingdesc_stored: row?.THINKINGDESC ?? row?.thinkingdesc ?? null,
          },
        ],
      };

      console.info("[chatbot-response] OK in", Date.now() - startedAt, "ms");
      return res.status(200).json(payload);
    } catch (err) {
      console.error("[chatbot-response] FATAL", err);
      logAuditError({
        eventType: "ERROR",
        errorMessage: err.message || String(err),
        context: JSON.stringify({
          endpoint: req.originalUrl,
          method: req.method,
        }),
        logDesc: "Failure in " + req.originalUrl,
        userId: req.headers["x-user-id"] || "unknown",
        querId: err.statementId || "UNKNOWN",
      });
      return res
        .status(500)
        .json({
          error: "Failed to save chatbot response",
          details: err?.message || String(err),
        });
    }
  })();
});

// -----------------------------
// POST /api/chatbot-feedback
// Maps 'up'/'down' to 1/0 BEFORE calling INT procedure; captures user_id as caller passes
// Optionally resolves response_id if not passed
// -----------------------------
app.post("/api/chatbot-feedback", (req, res) => {
  let {
    response_id, // may be null; if null, can resolve from identifiers below
    feedback_rating, // caller may send 1/0; if 'up'/'down', we convert safely
    user_id, // <-- captured exactly as caller passes (can be null)
    chatbot_id, // optional for resolution
    question, // optional for resolution
    response, // optional for resolution
    model_name, // optional for resolution
  } = req.body;

  // If you want to enforce non-null numeric user_id, uncomment:
  // if (user_id == null) return res.status(400).json({ error: "user_id is required" });
  // if (!Number.isFinite(Number(user_id))) return res.status(400).json({ error: "user_id must be numeric" });

  const uidNum = user_id == null ? null : Number(user_id);
  console.log("[FEEDBACK] body.user_id:", user_id, "typeof:", typeof user_id);

  // Normalize rating to INT: 1 (up) / 0 (down) / null
  let ratingNum = null;
  if (feedback_rating !== undefined && feedback_rating !== null) {
    const raw = String(feedback_rating).trim().toLowerCase();
    if (raw === "up" || raw === "1") ratingNum = 1;
    else if (raw === "down" || raw === "0") ratingNum = 0;
    else if (!isNaN(Number(raw))) ratingNum = Number(raw); // allow ints directly
  }

  const doCall = (rid) => {
    if (rid == null) {
      return res.status(400).json({ error: "response_id is required" });
    }
    const callSql = `CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_sp_save_chatbot_feedback(?, ?, ?)`;
    connection.execute({
      sqlText: callSql,
      binds: [
        Number(rid),
        ratingNum, // INT as your proc expects
        uidNum, // stored exactly as caller passes (numeric or null)
      ],
      complete: (err, _stmt, rows) => {
        if (err) {
          console.error("Error executing R_sp_save_chatbot_feedback:", err);
          return res
            .status(500)
            .json({
              error: "Failed to save chatbot feedback",
              details: err.message,
            });
        }
        const feedback_id = rows?.[0]
          ? Number(Object.values(rows[0])[0])
          : null;
        return res.json({
          feedback_id,
          response_id: rid,
          user_id_sent: uidNum,
          user_id_stored: uidNum, // stored as-is inside your proc
        });
      },
    });
  };

  // If caller provided response_id, save immediately
  if (response_id != null) {
    return doCall(Number(response_id));
  }

  // Optional: resolve response_id if caller didn't provide it (needs full identifiers)
  if (chatbot_id && model_name && question && response) {
    const sql = `
      SELECT response_id
      FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_CHATBOT_RESPONSE_TBL
      WHERE chatbot_id = ? AND model_name = ? AND question = ? AND response = ?
      ORDER BY start_time DESC
      LIMIT 1
    `;
    connection.execute({
      sqlText: sql,
      binds: [
        Number(chatbot_id),
        String(model_name),
        String(question),
        String(response),
      ],
      complete: (e2, _stmt2, rows2) => {
        if (e2) {
          console.error("Resolve response_id (feedback) failed:", e2);
          return res
            .status(500)
            .json({ error: "Failed to resolve response_id" });
        }
        const rid =
          rows2 && rows2[0]
            ? Number(
                rows2[0].RESPONSE_ID ??
                  rows2[0].response_id ??
                  Object.values(rows2[0])[0],
              )
            : null;
        return doCall(rid);
      },
    });
  } else {
    return res.status(400).json({
      error:
        "response_id is required OR provide chatbot_id, model_name, question, and response to resolve it",
    });
  }
});

// Stage used to generate a browser‑valid presigned URL for streaming
const STAGE_NAME_FOR_SQL = "@RAG_PIPELINE_STAGE";
/**
 * GET /api/response
 *
 * LIST:
 *   GET /api/response
 *
 * DOWNLOAD (by file name or relative path):
 *   GET /api/response?download=1&name=<FILE_NAME>[&expiry=600]
 *   GET /api/response?download=1&path=<RELATIVE_PATH>[&expiry=600]
 */
app.get("/api/response", (req, res) => {
  const { download, name, path, expiry = "600" } = req.query;
  const expirySeconds = Number(expiry) || 600;

  // -------------------- DOWNLOAD FLOW (stream back to client) --------------------
  if (download === "1") {
    if (!name && !path) {
      return res.status(400).json({
        error: "Provide ?name=<FILE_NAME> or ?path=<RELATIVE_PATH>",
      });
    }

    // 1) Resolve the row from DOCS_CHUNKS_TABLE by file name (preferred) or relative path
    const resolveRowSql = name
      ? `
          SELECT RELATIVE_PATH, FILE_URL, SCOPED_FILE_URL
          FROM DOCS_CHUNKS_TABLE
          WHERE SPLIT_PART(RELATIVE_PATH, '/', -1) = ?
          QUALIFY ROW_NUMBER() OVER (ORDER BY CHUNK_INDEX) = 1
          LIMIT 1;
        `
      : `
          SELECT RELATIVE_PATH, FILE_URL, SCOPED_FILE_URL
          FROM DOCS_CHUNKS_TABLE
          WHERE RELATIVE_PATH = ?
          QUALIFY ROW_NUMBER() OVER (ORDER BY CHUNK_INDEX) = 1
          LIMIT 1;
        `;

    const bindVal = name || path;

    // 2) Build a presigned URL (browser‑valid) from RELATIVE_PATH and stream it
    const buildPresignedSql = `
        SELECT GET_PRESIGNED_URL(${STAGE_NAME_FOR_SQL}, ?, ?) AS URL;
      `;

    const streamPresignedToClient = (relativePath, storedScoped) => {
      // NOTE: storedScoped is available if you want to log/compare the saved SCOPED_FILE_URL
      connection.execute({
        sqlText: buildPresignedSql,
        binds: [relativePath, expirySeconds],
        complete: (e2, _stmt2, rows2) => {
          if (e2) {
            console.error("Error generating presigned URL:", e2);
            return res
              .status(500)
              .json({ error: "Failed to prepare download" });
          }
          const presigned = rows2 && rows2[0] && rows2[0].URL;
          if (!presigned) {
            return res
              .status(404)
              .json({ error: "File not found or URL not generated" });
          }

          const fileName = relativePath.split("/").pop() || "download.bin";

          // Force “Save as” + allow client to read filename via fetch()
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(fileName)}"`,
          );
          res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
          // Optional: if all docs are PDFs, uncomment:
          // res.setHeader("Content-Type", "application/pdf");

          try {
            const urlObj = new URL(presigned);
            const sfReq = https.request(urlObj, { method: "GET" }, (sfResp) => {
              const statusCode = sfResp.statusCode || 200;
              if (statusCode >= 400) res.status(statusCode);

              const ct = sfResp.headers["content-type"];
              if (ct && !res.getHeader("Content-Type")) {
                res.setHeader("Content-Type", ct);
              }
              sfResp.pipe(res);
            });

            sfReq.on("error", (e3) => {
              console.error("Error fetching presigned URL:", e3);
              if (!res.headersSent) {
                res.status(502).json({ error: "Failed to fetch file stream" });
              } else {
                res.end();
              }
            });

            sfReq.end();
          } catch (fetchErr) {
            console.error("Invalid presigned URL:", fetchErr);
            logAuditError({
              eventType: "ERROR",
              errorMessage: fetchErr.message || String(fetchErr),
              context: JSON.stringify({
                endpoint: req.originalUrl,
                method: req.method,
              }),
              logDesc: "Failure in " + req.originalUrl,
              userId: req.headers["x-user-id"] || "unknown",
              querId: fetchErr.statementId || "UNKNOWN",
            });
            return res.status(500).json({ error: "Invalid presigned URL" });
          }
        },
      });
    };

    // Resolve row and stream
    return connection.execute({
      sqlText: resolveRowSql,
      binds: [bindVal],
      complete: (e1, _stmt1, rows1) => {
        if (e1) {
          console.error("Error resolving file row:", e1);
          return res.status(500).json({ error: "Failed to resolve file" });
        }
        if (!rows1 || !rows1[0]) {
          return res
            .status(404)
            .json({ error: "File not found in DOCS_CHUNKS_TABLE" });
        }

        const relativePath = rows1[0].RELATIVE_PATH;
        const scopedStored = rows1[0].SCOPED_FILE_URL; // stored in your table (as requested)

        // For guaranteed download, use presigned URL (browser‑valid) and stream bytes.
        // Scoped URLs are session-bound and can 403 if used directly in normal browsers. ¹ ²
        return streamPresignedToClient(relativePath, scopedStored);
      },
    });
  }

  // -------------------- LIST FLOW --------------------
  const listSql = `
      SELECT
        RELATIVE_PATH,
        SPLIT_PART(RELATIVE_PATH, '/', -1) AS FILE_NAME,
        SIZE,
        CATEGORY,
        FILE_URL,
        SCOPED_FILE_URL
      FROM DOCS_CHUNKS_TABLE
      QUALIFY ROW_NUMBER() OVER (PARTITION BY RELATIVE_PATH ORDER BY CHUNK_INDEX) = 1
      ORDER BY FILE_NAME;
    `;

  connection.execute({
    sqlText: listSql,
    complete: (err, _stmt, rows) => {
      if (err) {
        console.error("Error executing list query:", err);
        return res.status(500).json({ error: "Failed to fetch documents" });
      }

      const data = (rows || []).map((r) => ({
        fileName: r.FILE_NAME,
        relativePath: r.RELATIVE_PATH,
        size: r.SIZE,
        category: r.CATEGORY,
        scopedUrlStored: r.SCOPED_FILE_URL, // you can display this for debugging if you want
        // Hyperlink points to download‑by‑name for robust downloads
        downloadUrl: `/api/response?download=1&name=${encodeURIComponent(r.FILE_NAME)}`,
      }));
      return res.json({ data });
    },
  });
});

app.get("/api/data", (req, res) => {
  const query = "SELECT * FROM AI_SCALABILITY_SCHEMA.R_raise_user LIMIT 10;"; // Replace with real table
  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("Query failed: " + err.message);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        res.status(500).send("Error fetching data");
      } else {
        res.json(rows);
      }
    },
  });
});

app.post("/response", (req, res) => {
  const { query } = req.body || {};
  if (!query) {
    return res.status(400).send("Query is required");
  }
  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("Query failed: " + err.message);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        res.status(500).send("Error fetching data");
      } else {
        res.json(rows);
      }
    },
  });
});

app.get("/api/procedure", (req, res) => {
  const query = "CALL AI_SCALABILITY_SCHEMA.SP_LIST_TABLES();"; // Replace with real table
  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("Query failed: " + err.message);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        res.status(500).send("Error fetching data");
      } else {
        res.json(rows);
      }
    },
  });
});
app.get("/api/files", (req, res) => {
  const query = "list @RAG_PIPELINE_STAGE;"; // Replace with real table
  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("Query failed: " + err.message);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        res.status(500).send("Error fetching data");
      } else {
        res.json(rows);
      }
    },
  });
});
app.post("/api/generate-prompts", async (req, res) => {
  const { domain, promptType, description } = req.body;

  if (!domain || !description) {
    return res
      .status(400)
      .json({ error: "Domain and description are required" });
  }

  try {
    const model = process.env.SNOWFLAKE_MODEL || "llama3.1-70b";

    // Escape quotes for Snowflake SQL
    const safeDescription = String(description).replace(/'/g, "''");

    // Rephrase description using Snowflake Cortex (optional, with safe fallback)
    const rephraseQuery = `
      SELECT SNOWFLAKE.CORTEX.COMPLETE('${model}', 'Rephrase this instruction (keep it factual and concise): ${safeDescription}')
    `;

    connection.execute({
      sqlText: rephraseQuery,
      complete: (err, stmt, rows) => {
        if (err) {
          console.error("Error generating prompt (rephrase):", err);
        }

        const rephrasedDescription =
          rows && rows[0] && rows[0][0]
            ? String(rows[0][0]).trim()
            : description;

        // Base prompt
        let finalPrompt =
          `You are an expert ${domain} chat assistant that ${rephrasedDescription}\n` +
          `between <context> and </context> tags.\n` +
          `When answering the question contained between <question> and </question> tags,\n` +
          `be concise and do not hallucinate.\n` +
          `If you don’t have the information, just say so.\n` +
          `Only answer the question if you can extract it from the CONTEXT provided.\n` +
          `Do not mention the CONTEXT used in your answer.`;

        // Deterministic one-shot block (no model call)
        if (String(promptType).toLowerCase() === "one-shot") {
          const oneShotBlock =
            `\n\nHere is a realistic one-shot example:\n\n` +
            `Sample Question:\n` +
            `What is the main purpose of a savings account?\n\n` +
            `Sample Answer:\n` +
            `A savings account allows you to deposit and store money while earning interest on your balance.`;

          finalPrompt += oneShotBlock;
        }

        return res.json({ prompts: [finalPrompt] });
      },
    });
  } catch (error) {
    console.error("Generate Prompt Error:", error?.message || error);
    logAuditError({
      eventType: "ERROR",
      errorMessage: error.message || String(error),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: error.statementId || "UNKNOWN",
    });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// -----------------------------
// Save Prompt Endpoint
// -----------------------------
app.post("/api/save-prompt", (req, res) => {
  const { name, description, prompt, domain, promptType } = req.body;
  if (!name || !prompt) {
    return res.status(400).json({ error: "Name and prompt are required" });
  }

  const query = `
    INSERT INTO D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_PROMPTS_TBL (NAME, USER_DESCRIPTION, GENERATED_PROMPT, DOMAIN, PROMPTING_TYPE)
    VALUES (?, ?, ?, ?, ?)
  `;

  connection.execute({
    sqlText: query,
    binds: [name, description, prompt, domain, promptType],
    complete: (err) => {
      if (err) {
        console.error("Error saving prompt:", err);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        return res.status(500).json({ error: "Failed to save prompt" });
      }
      res.json({ message: "Prompt saved successfully" });
    },
  });
});

app.get("/api/get_prompts", (req, res) => {
  const query = `
    SELECT PROMPT_ID AS id, NAME AS name, DOMAIN AS domain, PROMPTING_TYPE AS promptingType
    FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_PROMPTS_TBL
    ORDER BY PROMPT_ID DESC
  `;
  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("Error fetching prompts:", err);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        return res.status(500).json({ error: "Failed to fetch prompts" });
      }

      // Snowflake returns rows as array of objects with aliases applied
      const data = rows.map((r) => ({
        id: r.ID,
        name: r.NAME,
        domain: r.DOMAIN,
        promptingType: r.PROMPTINGTYPE,
      }));

      res.json(data);
    },
  });
});

// -----------------------------
// Delete Prompt Endpoint
// -----------------------------
app.delete("/api/deletePrompt/:id", (req, res) => {
  const { id } = req.params;
  const query = `DELETE FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_PROMPTS_TBL WHERE PROMPT_ID = ?`;

  connection.execute({
    sqlText: query,
    binds: [id],
    complete: (err) => {
      if (err) {
        console.error("Error deleting prompt:", err);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        return res.status(500).json({ error: "Failed to delete prompt" });
      }
      res.json({ message: "Prompt deleted successfully" });
    },
  });
});

app.post("/api/getResponse", async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "Question is required" });

  try {
    const searchQuery = `
      SELECT chunk FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.CC_SEARCH_SERVICE
      WHERE MATCH('${question.replace(/'/g, "''")}')
      LIMIT 5;
    `;
    const searchResults = await executeQuery(searchQuery);
    if (!searchResults || searchResults.length === 0) {
      return res
        .status(404)
        .json({ error: "No context found for the question" });
    }

    const contextChunks = searchResults.map((r) => r.CHUNK).join("\n\n");
    const fullPrompt = `You are an AI assistant.\n<context>\n${contextChunks}\n</context>\n<question>\n${question}\n</question>\nAnswer:`;

    const modelList = ["mistral-large2", "llama3.1-70b", "llama3.1-8b"];
    const responses = {};

    for (const model of modelList) {
      const cortexQuery = `SELECT SNOWFLAKE.CORTEX.COMPLETE('${model}', '${fullPrompt.replace(/'/g, "''")}');`;
      const result = await executeQuery(cortexQuery);
      responses[model] = result[0][Object.keys(result[0])[0]] || "No response.";
    }

    res.json({ question, responses });
  } catch (err) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    console.error("Backend Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

function executeQuery(sqlText) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      complete: (err, stmt, rows) => {
        if (err) reject(err);
        else resolve(rows);
      },
    });
  });
}

app.get("/api/event_types", (req, res) => {
  const sqlText = `
    SELECT DISTINCT event_type
    FROM r_audit_logs_tbl
    ORDER BY event_type
  `;

  connection.execute({
    sqlText,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("Query error:", err);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        return res.status(500).json({ error: "Failed to fetch event types" });
      }
      const eventTypes = rows
        .map((r) => r.EVENT_TYPE || r.event_type)
        .filter(Boolean);
      return res.json({ data: eventTypes });
    },
  });
});

app.get("/api/error-dashboard", (req, res) => {
  const { eventType, startDate, endDate } = req.query;

  let whereClause = "";
  const binds = [];

  if (eventType && eventType !== "all") {
    whereClause += whereClause ? " AND" : " WHERE";
    whereClause += ` UPPER(EVENT_TYPE) = ?`;
    binds.push(eventType.toUpperCase());
  }

  if (startDate && endDate) {
    whereClause += whereClause ? " AND" : " WHERE";
    whereClause += ` CREATED_AT BETWEEN ? AND ?`;
    // keep day boundaries (Snowflake will parse these as timestamps)
    binds.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
  }

  // We add CREATED_AT_DMY and keep the original CREATED_AT
  const query = `
    SELECT
      EVENT_TYPE,
      ERROR_MESSAGE,
      CONTEXT,
      CREATED_AT,
      TO_CHAR(CREATED_AT, 'DD-MM-YYYY')  AS CREATED_AT_DMY,
      MONTHNAME(CREATED_AT)              AS CREATED_AT_MONTH,
      MONTH(CREATED_AT)                  AS CREATED_AT_MONTH_NUM,
      YEAR(CREATED_AT)                   AS CREATED_AT_YEAR
    FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_AUDIT_LOGS_Tbl
    ${whereClause}
    ORDER BY CREATED_AT DESC
  `;

  connection.execute({
    sqlText: query,
    binds,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("Error fetching dashboard data:", err);
        return res
          .status(500)
          .json({
            error: "Failed to fetch dashboard data",
            details: err.message,
          });
      }

      // -----------------------------
      // Error Logs (table) — now uses dd-mm-yyyy
      // -----------------------------
      const errorLogs = rows.map((row, index) => ({
        sno: index + 1,
        eventType: row.EVENT_TYPE || "",
        errorMessage: row.ERROR_MESSAGE || "",
        context: row.CONTEXT || "",
        date: row.CREATED_AT_DMY || "", // <-- dd-mm-yyyy
      }));

      // -----------------------------
      // App Stats (donut)
      // -----------------------------
      const appStatsMap = {};
      rows.forEach((row) => {
        const et = (row.EVENT_TYPE || "Unknown").toString();
        appStatsMap[et] = (appStatsMap[et] || 0) + 1;
      });
      const appStats = Object.entries(appStatsMap).map(([name, value]) => ({
        name,
        value,
      }));

      // -----------------------------
      // Monthly Error Trends (by EVENT_TYPE)
      // - Keyed by "MonthName YYYY" (e.g., "December 2025")
      // - Sorted by (year, month_num)
      // -----------------------------
      const trendMap = {}; // { '2025-12': { _label: 'December 2025', EVENT_A: n, ... } }
      const seriesSet = new Set(); // unique event types (UPPER)

      rows.forEach((row) => {
        const eventKey = row.EVENT_TYPE
          ? row.EVENT_TYPE.toUpperCase()
          : "UNKNOWN";
        seriesSet.add(eventKey);

        const monthName = row.CREATED_AT_MONTH || "Unknown";
        const year = row.CREATED_AT_YEAR || 0;
        const monthNum = row.CREATED_AT_MONTH_NUM || 0;

        const label = `${monthName} ${year}`; // display label for monthly chart
        const sortKey = `${year.toString().padStart(4, "0")}-${monthNum
          .toString()
          .padStart(2, "0")}`; // for sorting

        if (!trendMap[sortKey]) trendMap[sortKey] = { _label: label };
        trendMap[sortKey][eventKey] = (trendMap[sortKey][eventKey] || 0) + 1;
      });

      const errorTrendsData = Object.entries(trendMap)
        .map(([sortKey, counts]) => {
          return { _sortKey: sortKey, month: counts._label, ...counts };
        })
        .sort((a, b) =>
          a._sortKey < b._sortKey ? -1 : a._sortKey > b._sortKey ? 1 : 0,
        )
        .map(({ _sortKey, _label, ...rest }) => rest);

      const seriesKeys = Array.from(seriesSet);

      res.json({
        errorLogs,
        appStats,
        errorTrends: {
          // Example row:
          // { month: 'December 2025', FALLBACK: 12, REGISTER: 3, ... }
          data: errorTrendsData,
          seriesKeys, // ['FALLBACK', 'REGISTER', 'TOOL_FAILURE', ...]
        },
      });
    },
  });
});

/**
 * ✅ 4. Trigger Error Mail
 */
app.post("/api/send-error-mail", (req, res) => {
  const query = `CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.SEND_FAILED_AUDIT_LOG_EMAIL()`;

  connection.execute({
    sqlText: query,
    binds: [], // No parameters for stored procedure
    complete: (err) => {
      if (err) {
        console.error("Error sending email:", err);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        return res.status(500).json({ error: "Failed to send error mail" });
      }
      res.json({ message: "Error mail sent successfully!" });
    },
  });
});

/* ----------------------------- Config ----------------------------- */
const RAW_TEXT_TABLE = process.env.RAW_TEXT_TABLE ?? "RAW_TEXT_FINAL";

const SEMANTIC_DB = process.env.SEMANTIC_DB ?? "D_IN_CAPG_POC_AI_SCALABILITY";
const SEMANTIC_SCHEMA = process.env.SEMANTIC_SCHEMA ?? "AI_SCALABILITY_SCHEMA";
const SEMANTIC_STAGE = process.env.SEMANTIC_STAGE ?? "RAG_PIPELINE_STAGE";

/* ----------------------------- Helpers ---------------------------- */
function quoteIdent(id) {
  return `"${String(id).replace(/"/g, '""')}"`;
}

async function execSingle(sql) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sql,
      complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows ?? [])),
    });
  });
}

async function execQuery(sqlText, { role, warehouse, database, schema } = {}) {
  const contextStmts = [];
  if (role) contextStmts.push(`USE ROLE ${quoteIdent(role)}`);
  if (warehouse) contextStmts.push(`USE WAREHOUSE ${quoteIdent(warehouse)}`);
  if (database) contextStmts.push(`USE DATABASE ${quoteIdent(database)}`);
  if (schema) contextStmts.push(`USE SCHEMA ${quoteIdent(schema)}`);
  for (const stmt of contextStmts) await execSingle(stmt);
  return await execSingle(sqlText);
}

async function execWithBinds(
  sqlText,
  binds,
  { role, warehouse, database, schema } = {},
) {
  const contextStmts = [];
  if (role) contextStmts.push(`USE ROLE ${quoteIdent(role)}`);
  if (warehouse) contextStmts.push(`USE WAREHOUSE ${quoteIdent(warehouse)}`);
  if (database) contextStmts.push(`USE DATABASE ${quoteIdent(database)}`);
  if (schema) contextStmts.push(`USE SCHEMA ${quoteIdent(schema)}`);
  for (const stmt of contextStmts) await execSingle(stmt);

  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows ?? [])),
    });
  });
}

function getDomainFromPipeline(pipelineName) {
  return String(pipelineName ?? "")
    .toLowerCase()
    .replace(/_pipeline$/, "")
    .replace(/[^a-z0-9]+/g, "_");
}

// --- Name helpers ---
function getChunkTableName(domainName) {
  // R_<DOMAIN>_CHUNKS_TBL  e.g., R_BANKING_CHUNKS_TBL
  return `R_${domainName.toUpperCase()}_CHUNKS_TBL`;
}

function getSearchServiceName(domainName) {
  // R_<domain>_search_service  e.g., R_banking_search_service
  return `R_${domainName.toLowerCase()}_search_service`;
}

async function ensureDomainTableExists(tableName, { database, schema }) {
  const ddl = `
    CREATE TABLE IF NOT EXISTS ${quoteIdent(tableName)} (
      RELATIVE_PATH STRING,
      SIZE NUMBER,
      FILE_URL STRING,
      SCOPED_FILE_URL STRING,
      CHUNK STRING,
      CHUNK_INDEX NUMBER,
      CHUNKING_METHOD STRING,
      CATEGORY STRING
    )
  `;
  await execQuery(ddl, { warehouse: WAREHOUSE, database, schema });
}

// async function createOrReplaceSearchService({ db, schema, serviceName, tableName }) {
//   // Ensure DB/Schema context (safe even if already set)
//   await execQuery(`USE DATABASE ${quoteIdent(db)}`);
//   await execQuery(`USE SCHEMA ${quoteIdent(schema)}`);

//   const sql = `
//     CREATE OR REPLACE CORTEX SEARCH SERVICE ${quoteIdent(serviceName)}
//     ON CHUNK
//     ATTRIBUTES CATEGORY
//     WAREHOUSE='${WAREHOUSE}'
//     TARGET_LAG='1 minute'
//     AS (
//       SELECT
//         CHUNK,
//         CHUNK_INDEX,
//         RELATIVE_PATH,
//         FILE_URL,
//         SCOPED_FILE_URL,
//         CATEGORY
//       FROM ${quoteIdent(tableName)}
//     )
//   `;
//   await execQuery(sql);
// }

const toFileUri = (p) => `file://${p.replace(/\\/g, "/")}`;

/* ----------------------- Dropdown Endpoints ----------------------- */
app.get("/api/databases", async (req, res) => {
  try {
    const rows = await execQuery("SHOW DATABASES");
    res.json(
      rows
        .map((r) => r.name ?? r[1])
        .filter(Boolean)
        .sort(),
    );
  } catch (err) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    res.status(500).json({ error: "Failed to fetch databases" });
  }
});

app.get("/api/schemas", async (req, res) => {
  const db = req.query.db;
  if (!db) return res.status(400).json({ error: "Database name required" });
  try {
    const rows = await execQuery(`SHOW SCHEMAS IN DATABASE ${quoteIdent(db)}`);
    res.json(
      rows
        .map((r) => r.name ?? r[1])
        .filter(Boolean)
        .sort(),
    );
  } catch (err) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    res.status(500).json({ error: "Failed to fetch schemas" });
  }
});

app.get("/api/stages", async (req, res) => {
  const { db, schema } = req.query;
  if (!db || !schema)
    return res.status(400).json({ error: "DB and Schema required" });
  try {
    const rows = await execQuery(
      `SHOW STAGES IN ${quoteIdent(db)}.${quoteIdent(schema)}`,
    );
    res.json(
      rows
        .map((r) => r.name ?? r[1])
        .filter(Boolean)
        .sort(),
    );
  } catch (err) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    res.status(500).json({ error: "Failed to fetch stages" });
  }
});

app.get("/api/stage-files", async (req, res) => {
  const { db, schema, stage } = req.query;
  if (!db || !schema || !stage) {
    return res.status(400).json({ error: "DB, Schema, and Stage required" });
  }

  try {
    const listSql = `LIST @${quoteIdent(db)}.${quoteIdent(schema)}.${quoteIdent(stage)}`;
    const rows = await execQuery(listSql);

    const files = (rows ?? [])
      .map((r) => {
        const pathVal = r.name ?? r.path ?? r.file ?? r[0];
        const base = pathVal ? String(pathVal).split("/").pop() : undefined;
        return base && /\.(pdf|docx?|txt)$/i.test(base) ? base : undefined;
      })
      .filter(Boolean);
    res.json(files);
  } catch (err) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    console.error("Error fetching stage files:", err.message);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

app.get("/api/semantic-views", async (req, res) => {
  try {
    const sql = `SHOW SEMANTIC VIEWS IN SCHEMA ${quoteIdent(SEMANTIC_DB)}.${quoteIdent(SEMANTIC_SCHEMA)}`;
    const rows = await execQuery(sql);
    res.json(
      rows
        .map((r) => r.name ?? r[1])
        .filter(Boolean)
        .sort(),
    );
  } catch (err) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    res.status(500).json({ error: "Failed to fetch semantic views" });
  }
});

app.get("/api/views", async (req, res) => {
  try {
    const sql = `SHOW VIEWS IN SCHEMA ${quoteIdent(SEMANTIC_DB)}.${quoteIdent(SEMANTIC_SCHEMA)}`;
    const rows = await execQuery(sql);
    res.json(
      rows
        .map((r) => r.name ?? r[1])
        .filter(Boolean)
        .sort(),
    );
  } catch (err) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    res.status(500).json({ error: "Failed to fetch views" });
  }
});

app.get("/api/semantic-models", async (req, res) => {
  try {
    if (!SEMANTIC_DB || !SEMANTIC_SCHEMA || !SEMANTIC_STAGE) {
      return res
        .status(400)
        .json({ error: "SEMANTIC_DB/SCHEMA/STAGE not configured" });
    }
    await execQuery(`USE WAREHOUSE ${quoteIdent(WAREHOUSE)}`);
    await execQuery(`USE DATABASE ${quoteIdent(SEMANTIC_DB)}`);
    await execQuery(`USE SCHEMA ${quoteIdent(SEMANTIC_SCHEMA)}`);

    const listSql = `LIST @${quoteIdent(SEMANTIC_DB)}.${quoteIdent(SEMANTIC_SCHEMA)}.${quoteIdent(SEMANTIC_STAGE)}`;
    const rows = await execQuery(listSql);

    const getName = (r) =>
      r.NAME ?? r.name ?? r.PATH ?? r.path ?? r.FILE ?? r.file ?? r[0];
    const yamlFiles = (rows ?? [])
      .map((r) => String(getName(r)))
      .filter(Boolean)
      .map((full) => full.split("/").pop())
      .filter(
        (f) =>
          f &&
          (f.toLowerCase().endsWith(".yaml") ||
            f.toLowerCase().endsWith(".yml")),
      )
      .sort();

    res.json(yamlFiles);
  } catch (e) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: e.message || String(e),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: e.statementId || "UNKNOWN",
    });
    console.error("semantic-models error:", e);
    res.status(500).json({ error: "Failed to fetch semantic models" });
  }
});

/* ---------------- Split PDF (fileName optional, PDFs only) ---------------- */

app.post("/api/split-pdf", async (req, res) => {
  const { stage, fileName } = req.body;
  if (!stage || !String(stage).trim()) {
    return res.status(400).json({ error: "Stage required" });
  }

  const tmpDir = path.resolve(process.cwd(), "tmp");
  try {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Tmp dir not writable", details: e.message });
  }

  try {
    let targetFiles = [];

    if (fileName && String(fileName).trim() !== "") {
      targetFiles = [String(fileName).trim()];
    } else {
      const listSql = `LIST @${stage}`;
      const rows = await execQuery(listSql);
      targetFiles = (rows ?? [])
        .map((r) => {
          const pathVal = r.name ?? r.path ?? r.file ?? r[0];
          const base = pathVal ? String(pathVal).split("/").pop() : undefined;
          return base && /\.(pdf|docx?|txt)$/i.test(base) ? base : undefined;
        })
        .filter(Boolean);
    }

    if (!targetFiles.length) {
      return res.json({
        message: "No PDF files found in the stage.",
        splitFiles: [],
      });
    }

    const allSplitFiles = [];
    const messages = [];

    for (const f of targetFiles) {
      if (!/\.pdf$/i.test(f)) {
        messages.push(`ℹ️ Skipped non-PDF: ${f}`);
        continue;
      }

      const localPath = path.join(tmpDir, f);

      // Use proper file URI with triple slash to the directory
      const fileUri = `file://${tmpDir.replace(/\\/g, "/")}/`;
      const getSql = `GET @${stage}/${f} '${fileUri}'`;
      await execQuery(getSql);

      if (!fs.existsSync(localPath)) {
        messages.push(`❌ Download failed for ${f}`);
        continue;
      }
      const stat = fs.statSync(localPath);
      if (stat.size === 0) {
        messages.push(`❌ Download produced empty file for ${f}`);
        continue;
      }

      let pdfDoc;
      try {
        const pdfBytes = fs.readFileSync(localPath);
        pdfDoc = await PDFDocument.load(pdfBytes);
      } catch (e) {
        messages.push(`❌ Invalid PDF ${f}: ${e.message}`);
        continue;
      }

      const totalPages = pdfDoc.getPageCount();
      const baseName = path.parse(f).name.split("_part_")[0];

      if (totalPages > 300) {
        const batchSize = 300;
        const numBatches = Math.ceil(totalPages / batchSize);
        const splitFiles = [];

        for (let b = 0; b < numBatches; b++) {
          const newPdf = await PDFDocument.create();
          const start = b * batchSize;
          const end = Math.min(start + batchSize, totalPages);

          const pages = await newPdf.copyPages(
            pdfDoc,
            Array.from({ length: end - start }, (_, i) => start + i),
          );
          pages.forEach((p) => newPdf.addPage(p));

          const partFileName = `${baseName}_part_${b + 1}.pdf`;
          const partPath = path.join(tmpDir, partFileName);
          const partBytes = await newPdf.save();
          fs.writeFileSync(partPath, partBytes);
          splitFiles.push(partFileName);
          allSplitFiles.push(partFileName);
        }

        // Upload each part explicitly into a subfolder named after the base file
        for (const partName of splitFiles) {
          const partUri = `file://${path.join(tmpDir, partName).replace(/\\/g, "/")}`;
          const putSql = `PUT '${partUri}' @${stage}/${baseName} AUTO_COMPRESS=FALSE OVERWRITE=TRUE`;
          await execQuery(putSql);
        }

        messages.push(
          `✅ ${f}: split into ${splitFiles.length} parts and uploaded to @${stage}/${baseName}/`,
        );
      } else {
        // NO SPLITTING: do not create a subfolder, do not re-upload the original.
        messages.push(
          `ℹ️ ${f}: ${totalPages} pages — no splitting performed; original left as-is.`,
        );
        // Intentionally NOT pushing the original into allSplitFiles, so splitFiles=[] for non-split case
      }
    }

    return res.json({
      message: messages.join("\n"),
      splitFiles: allSplitFiles, // Only parts created by splitting
    });
  } catch (err) {
    console.error("Split error:", err);
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    res
      .status(500)
      .json({
        error: "Failed to process PDF(s)",
        details: err?.message || String(err),
      });
  }
});

/* --------- Chunking Endpoint (PDF-only, prefer parts, bind inserts, create search service) --------- */
// app.post("/api/run-chunking", async (req, res) => {
//   try {
//     const {
//       db,
//       schema,
//       stage,
//       fileName,
//       chunkMethod,
//       chunkSize,
//       chunkOverlap,
//       pipelineName,
//       attributeFilters // <-- NEW (optional): array of attribute column names
//     } = req.body;

//     if (!db || !schema || !stage || !fileName || !chunkMethod || !pipelineName) {
//       return res.status(400).json({ success: false, message: "Missing parameters" });
//     }

//     const isPdf = /\.pdf$/i.test(fileName);
//     const domainName = getDomainFromPipeline(pipelineName);

//     // ✅ Naming for table + service
//     const tableName   = getChunkTableName(domainName);     // e.g., R_BANKING_CHUNKS_TBL
//     const serviceName = getSearchServiceName(domainName);  // e.g., R_BANKING_SEARCH_SERVICE

//     // Context & table
//     await execQuery(`USE WAREHOUSE ${quoteIdent(WAREHOUSE)}`);
//     await execQuery(`USE DATABASE ${quoteIdent(db)}`);
//     await execQuery(`USE SCHEMA ${quoteIdent(schema)}`);
//     await ensureDomainTableExists(tableName, { database: db, schema });

//     // Prefer parsed split parts in RAW_TEXT_FINAL (aka RAW_TEXT_TABLE) over original
//     const baseName = path.parse(fileName).name.split("_part_")[0];
//     const findPartsSql = `
//       SELECT RELATIVE_PATH
//       FROM ${quoteIdent(RAW_TEXT_TABLE)}
//       WHERE RELATIVE_PATH LIKE ?
//         AND LOWER(RELATIVE_PATH) LIKE '%.pdf'
//     `;
//     const partRows = await execWithBinds(findPartsSql, [`${baseName}/%.pdf`]);
//     const partPaths = (partRows ?? [])
//       .map((r) => (r.RELATIVE_PATH ?? r[0]))
//       .filter((p) => typeof p === "string" && /\.pdf$/i.test(p));

//     let relativePaths = [];
//     if (partPaths.length > 0) {
//       relativePaths = Array.from(new Set(partPaths)); // use split parts
//     } else {
//       if (!isPdf) {
//         return res.status(400).json({ success: false, message: "Only PDF files are supported for chunking." });
//       }
//       relativePaths = [fileName]; // original top-level PDF
//     }

//     // Pull parsed text rows
//     const placeholders = relativePaths.map(() => "?").join(",");
//     const selectSql = `
//       SELECT RELATIVE_PATH, SIZE, FILE_URL, SCOPED_FILE_URL, EXTRACTED_LAYOUT
//       FROM ${quoteIdent(RAW_TEXT_TABLE)}
//       WHERE RELATIVE_PATH IN (${placeholders})
//     `;
//     const rows = await execWithBinds(selectSql, relativePaths);

//     if (!rows.length) {
//       return res.status(404).json({
//         success: false,
//         message: "No parsed text found for selected paths.",
//         paths: relativePaths,
//       });
//     }

//     const method = chunkMethod === "FixedSizeChunking" ? "fixed" : "recursive";

//     // Build rows to insert (in memory)
//     const rowsToInsert = [];
//     for (const row of rows) {
//       const relPath   = row.RELATIVE_PATH    ?? row[0];
//       const size      = row.SIZE             ?? row[1];
//       const fileUrl   = row.FILE_URL         ?? row[2];
//       const scopedUrl = row.SCOPED_FILE_URL  ?? row[3];
//       const extracted = row.EXTRACTED_LAYOUT ?? row[4];

//       if (!extracted || String(extracted).trim().length === 0) continue;

//       const chunks =
//         method === "fixed"
//           ? chunkTextFixed(String(extracted), Number(chunkSize ?? 1000), Number(chunkOverlap ?? 0))
//           : chunkTextRecursive(String(extracted));

//       let i = 0;
//       for (const ch of chunks) {
//         rowsToInsert.push({
//           relPath: String(relPath),
//           size: Number(size ?? 0),
//           fileUrl: String(fileUrl ?? ""),
//           scopedUrl: String(scopedUrl ?? ""),
//           chunk: String(ch),
//           idx: i++,
//           method,
//           category: domainName,
//         });
//       }
//     }

//     if (rowsToInsert.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Parsed content was empty after extraction; no chunks to insert.",
//       });
//     }

//     // Batch insert using binds
//     const BATCH_SIZE = 200;
//     let inserted = 0;
//     for (let start = 0; start < rowsToInsert.length; start += BATCH_SIZE) {
//       const batch = rowsToInsert.slice(start, start + BATCH_SIZE);
//       const valuePlaceholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");

//       const insertSql = `
//         INSERT INTO ${quoteIdent(tableName)} (
//           RELATIVE_PATH, SIZE, FILE_URL, SCOPED_FILE_URL, CHUNK, CHUNK_INDEX, CHUNKING_METHOD, CATEGORY
//         ) VALUES ${valuePlaceholders}
//       `;

//       const binds = [];
//       for (const r of batch) {
//         binds.push(
//           r.relPath, r.size, r.fileUrl, r.scopedUrl,
//           r.chunk, r.idx, r.method, r.category
//         );
//       }

//       const resInsert = await execWithBinds(insertSql, binds);
//       inserted += Number(resInsert?.rowCount ?? batch.length);
//     }

//     // Verify table written
//     const verify = await execQuery(`SELECT COUNT(*) AS CNT FROM ${quoteIdent(tableName)}`);
//     const verifyCount = (verify[0].CNT ?? verify[0].cnt ?? verify[0][0]) ?? 0;

//     // Create/replace Cortex Search service on this chunk table with dynamic attributes

//     await createOrReplaceSearchService({
//       db,
//       schema,
//       serviceName,
//       tableName,
//       attributeFilters // keep passing if you need attributes for service indexing (not shown in message)
//     });

//     // Build clean message without attributes or tables text

//     return res.json({
//       success: verifyCount > 0,
//       message: `Chunking completed. Inserted chunks into ${tableName}. Search service created: ${serviceName}`,
//     });

//   } catch (err) {
//     console.error("Chunking error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Chunking failed",
//       error: String(err.message ?? err),
//     });
//   }
// });

// async function createOrReplaceSearchService({
//   db,
//   schema,
//   serviceName,
//   tableName,
//   attributeFilters
// }) {
//   // Ensure DB/Schema context (safe even if already set)
//   await execQuery(`USE DATABASE ${quoteIdent(db)}`);
//   await execQuery(`USE SCHEMA ${quoteIdent(schema)}`);

//   const fqChunk = `${quoteIdent(tableName)} c`;
//   const fqRaw   = `${quoteIdent(RAW_TEXT_TABLE)} r`;

//   // Always include CATEGORY by default (current behavior)
//   const baseAttrs = ["CATEGORY"];
//   const requested = Array.isArray(attributeFilters) ? attributeFilters : [];

//   // Sanitize + normalize + de-duplicate
//   const attrs = Array.from(
//     new Set(
//       [...baseAttrs, ...requested]
//         .map(sanitizeAttrName)
//         .filter(Boolean)
//     )
//   );

//   // Discover columns in both tables
//   const [chunkCols, rawCols] = await Promise.all([
//     getTableColumnSet(`${quoteIdent(tableName)}`),
//     getTableColumnSet(`${quoteIdent(RAW_TEXT_TABLE)}`)
//   ]);

//   // Build SELECT clause
//   const selectPieces = [
//     "c.CHUNK",
//     "c.CHUNK_INDEX",
//     "c.RELATIVE_PATH",
//     "c.FILE_URL",
//     "c.SCOPED_FILE_URL",
//   ];

//   const usableAttributes = [];
//   for (const a of attrs) {
//     if (chunkCols.has(a)) {
//       selectPieces.push(`c.${quoteIdent(a)} AS ${quoteIdent(a)}`);
//       usableAttributes.push(a);
//     } else if (rawCols.has(a)) {
//       selectPieces.push(`r.${quoteIdent(a)} AS ${quoteIdent(a)}`);
//       usableAttributes.push(a);
//     } else {
//       console.warn(`[createOrReplaceSearchService] Attribute '${a}' not found in ${tableName} or ${RAW_TEXT_TABLE}; skipping.`);
//     }
//   }

//   if (usableAttributes.length === 0) {
//     throw new Error(
//       `No valid attributes found to index. Requested: ${attrs.join(", ")}; checked tables: ${tableName} and ${RAW_TEXT_TABLE}.`
//     );
//   }

//   const attributesSql = usableAttributes.map(quoteIdent).join(", ");
//   const selectSql = selectPieces.join(",\n        ");

//   const sql = `
//     CREATE OR REPLACE CORTEX SEARCH SERVICE ${quoteIdent(serviceName)}
//     ON CHUNK
//     ATTRIBUTES ${attributesSql}
//     WAREHOUSE='${WAREHOUSE}'
//     TARGET_LAG='1 minute'
//     AS (
//       SELECT
//         ${selectSql}
//       FROM ${fqChunk}
//       LEFT JOIN ${fqRaw}
//         ON r.RELATIVE_PATH = c.RELATIVE_PATH
//     )
//   `;

//   await execQuery(sql);

//   return { usableAttributes };
// }

app.post("/api/run-chunking", async (req, res) => {
  try {
    const {
      db,
      schema,
      stage,
      fileNames,
      fileName,
      chunkMethod,
      chunkSize,
      chunkOverlap,
      pipelineName,
    } = req.body;
    // Support both fileNames (array) and legacy fileName (string)
    const allFiles =
      Array.isArray(fileNames) && fileNames.length > 0
        ? fileNames
        : fileName
          ? [fileName]
          : [];
    if (
      !db ||
      !schema ||
      !stage ||
      !allFiles.length ||
      !chunkMethod ||
      !pipelineName
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing parameters" });
    }
    const domainName = getDomainFromPipeline(pipelineName);
    // ✅ New naming
    const tableName = getChunkTableName(domainName); // e.g., R_BANKING_CHUNKS_TBL
    const serviceName = getSearchServiceName(domainName); // e.g., R_banking_search_service
    // Context & table
    await execQuery(`USE WAREHOUSE ${quoteIdent(WAREHOUSE)}`);
    await execQuery(`USE DATABASE ${quoteIdent(db)}`);
    await execQuery(`USE SCHEMA ${quoteIdent(schema)}`);
    await ensureDomainTableExists(tableName, { database: db, schema });
    // Prefer parsed split parts in RAW_TEXT_FINAL over original
    // Process ALL files, not just the first one
    let relativePaths = [];
    for (const file of allFiles) {
      const baseName = path.parse(file).name.split("_part_")[0];
      const findPartsSql = `
        SELECT RELATIVE_PATH
        FROM ${quoteIdent(RAW_TEXT_TABLE)}
        WHERE RELATIVE_PATH LIKE ?
      `;
      const partRows = await execWithBinds(findPartsSql, [`${baseName}/%`]);
      const partPaths = (partRows ?? [])
        .map((r) => r.RELATIVE_PATH ?? r[0])
        .filter(
          (p) => typeof p === "string" && /\.(pdf|txt|doc|docx)$/i.test(p),
        );
      if (partPaths.length > 0) {
        relativePaths.push(...partPaths);
      } else {
        relativePaths.push(file); // original file (PDF, TXT, DOC, DOCX)
      }
    }
    relativePaths = Array.from(new Set(relativePaths)); // deduplicate
    // Pull parsed text rows
    const placeholders = relativePaths.map(() => "?").join(",");
    const selectSql = `
      SELECT RELATIVE_PATH, SIZE, FILE_URL, SCOPED_FILE_URL, EXTRACTED_LAYOUT
      FROM ${quoteIdent(RAW_TEXT_TABLE)}
      WHERE RELATIVE_PATH IN (${placeholders})
    `;
    const rows = await execWithBinds(selectSql, relativePaths);
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "No parsed text found for selected paths.",
        paths: relativePaths,
      });
    }
    const method = chunkMethod === "FixedSizeChunking" ? "fixed" : "recursive";
    // Build rows to insert (in memory)
    const rowsToInsert = [];
    for (const row of rows) {
      const relPath = row.RELATIVE_PATH ?? row[0];
      const size = row.SIZE ?? row[1];
      const fileUrl = row.FILE_URL ?? row[2];
      const scopedUrl = row.SCOPED_FILE_URL ?? row[3];
      const extracted = row.EXTRACTED_LAYOUT ?? row[4];
      if (!extracted || String(extracted).trim().length === 0) continue;
      const chunks =
        method === "fixed"
          ? chunkTextFixed(
              String(extracted),
              Number(chunkSize ?? 1000),
              Number(chunkOverlap ?? 0),
            )
          : chunkTextRecursive(String(extracted));
      let i = 0;
      for (const ch of chunks) {
        rowsToInsert.push({
          relPath: String(relPath),
          size: Number(size ?? 0),
          fileUrl: String(fileUrl ?? ""),
          scopedUrl: String(scopedUrl ?? ""),
          chunk: String(ch), // bind safely (prevents \u parsing errors)
          idx: i++,
          method,
          category: domainName,
        });
      }
    }
    // Batch insert using binds
    const BATCH_SIZE = 200;
    for (let start = 0; start < rowsToInsert.length; start += BATCH_SIZE) {
      const batch = rowsToInsert.slice(start, start + BATCH_SIZE);
      const valuePlaceholders = batch
        .map(() => "(?, ?, ?, ?, ?, ?, ?, ?)")
        .join(", ");
      const insertSql = `
        INSERT INTO ${quoteIdent(tableName)} (
          RELATIVE_PATH, SIZE, FILE_URL, SCOPED_FILE_URL, CHUNK, CHUNK_INDEX, CHUNKING_METHOD, CATEGORY
        ) VALUES ${valuePlaceholders}
      `;
      const binds = [];
      for (const r of batch) {
        binds.push(
          r.relPath,
          r.size,
          r.fileUrl,
          r.scopedUrl,
          r.chunk,
          r.idx,
          r.method,
          r.category,
        );
      }
      await execWithBinds(insertSql, binds);
    }
    // Verify table written
    const verify = await execQuery(
      `SELECT COUNT(*) AS CNT FROM ${quoteIdent(tableName)}`,
    );
    const verifyCount = verify[0].CNT ?? verify[0].cnt ?? verify[0][0] ?? 0;
    // Create/replace Cortex Search service on this chunk table
    await createOrReplaceSearchService({ db, schema, serviceName, tableName });
    return res.json({
      success: verifyCount > 0,
      message: `Chunking completed. Inserted chunks into ${tableName}. Search service created: ${serviceName}`,
      tables: [tableName],
      serviceName,
      verifyCount,
    });
  } catch (err) {
    console.error("Chunking error:", err);
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    return res.status(500).json({
      success: false,
      message: "Chunking failed",
      error: String(err.message ?? err),
    });
  }
});

async function createOrReplaceSearchService({
  db,
  schema,
  serviceName,
  tableName,
}) {
  // Ensure DB/Schema context (safe even if already set)
  await execQuery(`USE DATABASE ${quoteIdent(db)}`);
  await execQuery(`USE SCHEMA ${quoteIdent(schema)}`);

  const sql = `
    CREATE OR REPLACE CORTEX SEARCH SERVICE ${quoteIdent(serviceName)}
    ON CHUNK
    ATTRIBUTES CATEGORY
    WAREHOUSE='${WAREHOUSE}'
    TARGET_LAG='1 minute'
    AS (
      SELECT
        CHUNK,
        CHUNK_INDEX,
        RELATIVE_PATH,
        FILE_URL,
        SCOPED_FILE_URL,
        CATEGORY
      FROM ${quoteIdent(tableName)}
    )
  `;
  await execQuery(sql);
}

// POST /api/update_procedure_email
app.post("/api/update_procedure_email", (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({
      success: false,
      error: "EMAIL_REQUIRED",
      message: "Email is required in request body",
    });
  }

  // Minimal sanitization (binds don't apply inside DDL text)
  const safeEmail = email.replace(/'/g, "''");

  // If you want to *fully* qualify with DB/SCHEMA, uncomment:
  // const db = process.env.SNOWFLAKE_DATABASE;
  // const schema = process.env.SNOWFLAKE_SCHEMA;
  // const procName = `${db}.${schema}.send_failed_audit_log_email`;

  const procName = `send_failed_audit_log_email`;

  const sql = `
CREATE OR REPLACE PROCEDURE ${procName}()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
  error_message VARCHAR;
  event_type VARCHAR;
  log_desc VARCHAR;
  created_at VARCHAR;
  email_subject VARCHAR;
  email_body VARCHAR;
  sql_statement VARCHAR;
BEGIN
  -- Find the latest error containing "failed"
  SELECT
      COALESCE(event_type::VARCHAR, ''),
      COALESCE(error_message::VARCHAR, ''),
      COALESCE(log_desc::VARCHAR, ''),
      COALESCE(created_at::VARCHAR, '')
  INTO
      :event_type,
      :error_message,
      :log_desc,
      :created_at
  FROM r_audit_logs_tbl
  WHERE error_message ILIKE '%failed%'
  ORDER BY created_at DESC
  LIMIT 1;
 
  IF (error_message IS NOT NULL AND error_message != '') THEN
    email_subject := 'System Alert: Errors Detected in AI Scalability Platform';
    email_body := 'A new error has been detected.:\\n\\n' ||
                  'Event Type: ' || event_type || '\\n\\n' ||
                  'Error Message: ' || error_message || '\\n\\n' ||
                  'Log Description: ' || log_desc || '\\n\\n' ||
                  'Created At: ' || created_at || '\\n';
 
    -- Use the updated hardcoded recipient
    sql_statement := 'CALL SYSTEM$SEND_EMAIL(' ||
                     '''MY_EMAIL_INT'' , ' ||
                     '''${safeEmail}'' , ' ||
                     '''' || REPLACE(email_subject, '''', '''''') || ''' , ' ||
                     '''' || REPLACE(email_body, '''', '''''') || ''')';
 
    EXECUTE IMMEDIATE sql_statement;
 
    RETURN 'Email sent (or verification initiated) to ${safeEmail}.';
  ELSE
    RETURN 'No new errors containing "failed" found in audit logs.';
  END IF;
EXCEPTION
  WHEN OTHER THEN
    RETURN 'PROC_ERROR: ' || SQLERRM;
END;
$$;
`;

  connection.execute({
    sqlText: sql,
    complete: (err) => {
      if (err) {
        console.error("❌ PROCEDURE UPDATE ERROR:", err);
        return res.status(500).json({
          success: false,
          error: "PROC_UPDATE_FAILED",
          message: err.message,
        });
      }
      return res.json({
        success: true,
        message:
          "Procedure 'send_failed_audit_log_email' updated successfully. If this is a new email, Snowflake may require verification before notifications start.",
        updatedEmail: email,
      });
    },
  });
});

/**
 * GET /api/pipelines/:key
 * If :key looks like an ID, search by pipeline_id; else by pipeline_name.
 * Database pipelines return PipelineConfigResponse with databaseDetails.
 */
app.get("/api/pipeline-configuration/:key", async (req, res) => {
  const key = req.params.key;

  // Detect ID vs name (adjust if your IDs are UUIDs)
  const looksNumericId = /^\d+$/.test(key);
  const looksUuid = /^[0-9a-fA-F-]{36}$/.test(key);

  const whereClause =
    looksNumericId || looksUuid ? "pipeline_id = ?" : "pipeline_name = ?";
  const binds = [key];

  try {
    const metaSql = `
      SELECT
        pipeline_id,
        pipeline_name,
        file_source_type,
        database,
        schema,
        file_location,
        file_type,
        semantic_view,
        semantic_model,
        chunking_method,
        chunk_size,
        chunk_overlap,
        chunk_table,
        cortex_search_service,
        user_id,
        stream,                -- NEW
        task                   -- NEW
      FROM R_PIPELINE_METADATA_TBL
      WHERE ${whereClause}
      ORDER BY 1 DESC
      LIMIT 1
    `;
    const rows = await execWithBinds(metaSql, binds);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: `Pipeline '${key}' not found` });
    }

    const r = rows[0];
    const id = r.PIPELINE_ID ?? r.pipeline_id ?? null;
    const name = r.PIPELINE_NAME ?? r.pipeline_name ?? null;
    const sourceTypeRaw = String(
      r.FILE_SOURCE_TYPE ?? r.file_source_type ?? "",
    ).toUpperCase();

    // ---------- DATABASE PIPELINE SHAPE ----------
    if (sourceTypeRaw === "DATABASE") {
      const payload = {
        id: id == null ? String(key) : String(id),
        pipelineConfiguration: {
          dataPipelineName: name ?? "",
          fileSourceType: "database",
        },
        databaseDetails: {
          selectedDb: r.DATABASE ?? r.database ?? "",
          selectedSchema: r.SCHEMA ?? r.schema ?? "",
          semanticView: r.SEMANTIC_VIEW ?? r.semantic_view ?? "",
          semanticModel: r.SEMANTIC_MODEL ?? r.semantic_model ?? "",
          // Per your rule: saved only for cloud; surface nulls for DB
          stream: r.STREAM ?? r.stream ?? null,
          task: r.TASK ?? r.task ?? null,
        },
      };
      return res.json({ success: true, data: payload });
    }

    // ---------- CLOUD PIPELINE SHAPE ----------
    if (sourceTypeRaw === "CLOUD") {
      const db = r.DATABASE ?? r.database ?? null;
      const schema = r.SCHEMA ?? r.schema ?? null;

      // Derive chunkTable / search service if not provided
      const domain = getDomainFromPipeline(name);
      const derivedChunkTable =
        (r.CHUNK_TABLE ?? r.chunk_table) || getChunkTableName(domain);
      const derivedService =
        (r.CORTEX_SEARCH_SERVICE ?? r.cortex_search_service) ||
        getSearchServiceName(domain);

      const payload = {
        id: id == null ? String(key) : String(id),
        pipelineConfiguration: {
          dataPipelineName: name ?? "",
          fileSourceType: "cloud",
          fileLocation: r.FILE_LOCATION ?? r.file_location ?? "",
          fileType: r.FILE_TYPE ?? r.file_type ?? "",
        },
        chunkingDetails: {
          chunkingMethod: r.CHUNKING_METHOD ?? r.chunking_method ?? "",
          chunkingSize: Number(r.CHUNK_SIZE ?? r.chunk_size ?? 0),
          chunkOverlap: Number(r.CHUNK_OVERLAP ?? r.chunk_overlap ?? 0),
          chunkTable: derivedChunkTable ?? "",
          cortexSearchService: derivedService ?? "",
          // Include stream/task for cloud
          stream: r.STREAM ?? r.stream ?? "",
          task: r.TASK ?? r.task ?? "",
        },
        // Optional FQN context
        _database: db,
        _schema: schema,
      };
      return res.json({ success: true, data: payload });
    }

    // ---------- Fallback ----------
    return res.json({
      success: true,
      message: `Pipeline found but has unrecognized source type: ${sourceTypeRaw}`,
      data: {
        id: id == null ? String(key) : String(id),
        pipelineConfiguration: {
          dataPipelineName: name ?? "",
          fileSourceType: r.FILE_SOURCE_TYPE ?? r.file_source_type ?? "",
        },
      },
    });
  } catch (err) {
    console.error("GET /api/pipeline-configuration/:key error:", err);
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    return res.status(500).json({
      success: false,
      error: "Failed to fetch pipeline details",
      message: String(err?.message ?? err),
    });
  }
});
/* --------- Minimal Submit Pipeline (inserts only, no verbose response) --------- */

// server.js or routes/pipelines.js

// -----------------------------
// Imports & Setup
// -----------------------------
app.use(cors()); // Needed if React dev server runs on a different port
app.use(express.json({ limit: "5mb" })); // Parse JSON bodies

// -----------------------------
// Helpers
// -----------------------------
function exec(sqlText, binds = []) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows)),
    });
  });
}

const RETRIABLE_ERRORS = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ESOCKETTIMEDOUT",
]);

async function execWithRetry(
  sqlText,
  binds = [],
  { attempts = 3, baseDelayMs = 300 } = {},
) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await exec(sqlText, binds);
    } catch (err) {
      lastErr = err;
      const code = err?.code || err?.errno || err?.name;
      const msg = err?.message || String(err);

      const isNetwork =
        RETRIABLE_ERRORS.has(code) ||
        /ECONNRESET/i.test(msg) ||
        /timed out/i.test(msg);

      if (!isNetwork) break; // don't retry non-network errors

      const delay = baseDelayMs * Math.pow(2, i); // 300, 600, 1200ms
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function initSnowflakeContext() {
  try {
    // If your connection doesn't already set these, uncomment and set explicitly:
    // await exec(`USE ROLE ${process.env.SNOWFLAKE_ROLE}`);
    // await exec(`USE WAREHOUSE ${process.env.SNOWFLAKE_WAREHOUSE}`);
    // await exec(`USE DATABASE ${process.env.SNOWFLAKE_DATABASE}`);
    // await exec(`USE SCHEMA ${process.env.SNOWFLAKE_SCHEMA}`);

    const ctx = await exec(`
      SELECT CURRENT_ROLE() ROLE, CURRENT_WAREHOUSE() WH, CURRENT_DATABASE() DB, CURRENT_SCHEMA() SCHEMA
    `);
    console.log("Snowflake context:", ctx);

    // Verify the table exists and columns match expectations
    const desc = await exec(
      `DESC TABLE D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_PIPELINE_METADATA_TBL`,
    );
    console.log(
      "R_PIPELINE_METADATA_TBL columns:",
      desc.map((r) => ({ name: r.name, type: r.type, nullable: r.nullable })),
    );
  } catch (e) {
    console.error("initSnowflakeContext error:", e?.message ?? e);
  }
}

// -----------------------------
// Routes
// -----------------------------

// // Optional: avoid confusion when someone opens this POST endpoint in the browser
// app.get('/api/submit-pipeline', (_req, res) => {
//   res.status(405).send('Use POST for /api/submit-pipeline');
// });

/**
 * POST /api/submit-pipeline
 * Inserts a pipeline record aligned with the actual HYBRID TABLE columns.
 *
 * Expected body:
 * {
 *   pipelineName: string,
 *   dataSourceType: 'cloud'|'database',
 *   selectedDb: string,
 *   selectedSchema: string,
 *   // cloud
 *   fileLocation?: string,
 *   selectedFiles?: string|string[],
 *   chunkingMethod?: string,
 *   // database (mutually exclusive)
 *   semanticView?: string,
 *   semanticModel?: string,
 *   userId?: number
 * }
 */
// app.post("/api/submit-pipeline", async (req, res) => {
//   const body = req.body || {};
//   const {
//     pipelineName,
//     dataSourceType, // 'cloud' | 'database'
//     selectedDb,
//     selectedSchema,

//     // CLOUD-only
//     fileLocation,
//     selectedFiles, // string or string[]
//     chunkingMethod,
//     chunkSize,
//     chunkOverlap,
//     chunkTable,
//     cortexSearchService,

//     // DATABASE-only (mutually exclusive)
//     semanticView,
//     semanticModel,

//     userId,
//   } = body;

//   try {
//     if (!pipelineName) {
//       return res.status(400).json({ error: "pipelineName is required" });
//     }
//     if (!dataSourceType) {
//       return res.status(400).json({ error: "dataSourceType is required" });
//     }

//     // Uniqueness check
//     const checkSql = `
//       SELECT COUNT(*) AS count
//       FROM R_PIPELINE_METADATA_TBL
//       WHERE pipeline_name = ?
//     `;
//     const existingRows = await new Promise((resolve, reject) => {
//       connection.execute({
//         sqlText: checkSql,
//         binds: [pipelineName],
//         complete: (err, stmt, rows) => (err ? reject(err) : resolve(rows)),
//       });
//     });
//     const count = existingRows?.[0]?.COUNT ?? existingRows?.[0]?.count ?? 0;
//     if (count > 0) {
//       return res.status(400).json({
//         success: false,
//         error: "Pipeline name already exists. Please choose a different name.",
//       });
//     }

//     const source = String(dataSourceType).toLowerCase(); // 'cloud' | 'database'
//     // Derive mode strictly from source (do not trust client)
//     const mode = source === "cloud" ? "SEARCH" :
//                  source === "database" ? "ANALYST" : null;

//     const fileType =
//       Array.isArray(selectedFiles)
//         ? selectedFiles.join(", ")
//         : (selectedFiles ?? null);

//     if (source === "database") {
//       if (!selectedDb || !selectedSchema) {
//         return res.status(400).json({ error: "Database and schema are required for database sourceType" });
//       }
//       const hasView = !!semanticView;
//       const hasModel = !!semanticModel;
//       if ((hasView && hasModel) || (!hasView && !hasModel)) {
//         return res.status(400).json({
//           error: "Provide exactly one: semanticView OR semanticModel for database sourceType",
//         });
//       }
//     } else if (source === "cloud") {
//       if (!selectedDb || !selectedSchema) {
//         return res.status(400).json({ error: "Database and schema are required for cloud sourceType" });
//       }
//       if (!fileLocation) {
//         return res.status(400).json({ error: "fileLocation (stage) is required for cloud sourceType" });
//       }
//       if (!fileType) {
//         return res.status(400).json({ error: "file_type (selectedFiles) is required for cloud sourceType" });
//       }
//       // Optional: enforce chunking inputs if you want
//       // if (!chunkingMethod) return res.status(400).json({ error: "chunkingMethod is required for cloud sourceType" });
//     } else {
//       return res.status(400).json({ error: "dataSourceType must be 'cloud' or 'database'" });
//     }

//     // Final guard: ensure derived mapping is consistent
//     if ((source === "cloud" && mode !== "SEARCH") ||
//         (source === "database" && mode !== "ANALYST")) {
//       return res.status(400).json({ error: "Invalid source-to-mode mapping" });
//     }

//     const values = {
//       pipeline_name: pipelineName,
//       mode,                               // <-- NEW
//       file_source_type: source.toUpperCase(), // CLOUD or DATABASE
//       database: selectedDb ?? null,
//       schema: selectedSchema ?? null,
//       file_location: source === "cloud" ? (fileLocation ?? null) : null,
//       file_type: source === "cloud" ? (fileType ?? null) : null,
//       semantic_view: source === "database" ? (semanticView ?? null) : null,
//       semantic_model: source === "database" ? (semanticModel ?? null) : null,
//       chunking_method: source === "cloud" ? (chunkingMethod ?? null) : null,
//       chunk_size:
//         source === "cloud"
//           ? (Number.isFinite(chunkSize) ? chunkSize : (chunkSize ?? null))
//           : null,
//       chunk_overlap:
//         source === "cloud"
//           ? (Number.isFinite(chunkOverlap) ? chunkOverlap : (chunkOverlap ?? null))
//           : null,
//       chunk_table: source === "cloud" ? (chunkTable ?? null) : null,
//       cortex_search_service: source === "cloud" ? (cortexSearchService ?? null) : null,
//       user_id: userId ?? null,
//     };

//     const sql = `
//       INSERT INTO R_PIPELINE_METADATA_TBL (
//         pipeline_name,
//         mode,                 -- <-- NEW
//         file_source_type,
//         database,
//         schema,
//         file_location,
//         file_type,
//         semantic_view,
//         semantic_model,
//         chunking_method,
//         chunk_size,
//         chunk_overlap,
//         chunk_table,
//         cortex_search_service,
//         user_id
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;

//     const binds = [
//       values.pipeline_name,
//       values.mode,                // <-- NEW
//       values.file_source_type,
//       values.database,
//       values.schema,
//       values.file_location,
//       values.file_type,
//       values.semantic_view,
//       values.semantic_model,
//       values.chunking_method,
//       values.chunk_size,
//       values.chunk_overlap,
//       values.chunk_table,
//       values.cortex_search_service,
//       values.user_id,
//     ];

//     await new Promise((resolve, reject) => {
//       connection.execute({
//         sqlText: sql,
//         binds,
//         complete: (err) => (err ? reject(err) : resolve()),
//       });
//     });

//     return res.json({ success: true, message: "Pipeline submitted successfully" });
//   } catch (err) {
//     console.error("Error inserting pipeline:", err.message);
//     return res.status(500).json({ success: false, error: "Failed to submit pipeline" });
//   }
// });

// app.post("/api/submit-pipeline", async (req, res) => {
//   const body = req.body || {};

//   const {
//     pipelineName,
//     dataSourceType, // 'cloud' | 'database'
//     selectedDb,
//     selectedSchema,

//     // CLOUD-only
//     fileLocation,
//     selectedFiles, // string or string[]
//     chunkingMethod,
//     chunkSize,
//     chunkOverlap,
//     chunkTable,
//     cortexSearchService,

//     // DATABASE-old (Talk to Data)
//     semanticView,
//     semanticModel,

//     // ✅ DATABASE-new (Talk to Document)
//     selectedTables,
//     createdSearchServices,
//     tableConfigs,

//     userId,
//   } = body;

//   // ---------- helpers ----------
//   const toCsv = (v) => {
//     if (!v) return null;
//     if (Array.isArray(v)) {
//       const cleaned = v.map(String).map((s) => s.trim()).filter(Boolean);
//       return cleaned.length ? cleaned.join(",") : null;
//     }
//     const s = String(v).trim();
//     return s ? s : null;
//   };

//   const nonEmptyString = (v) => {
//     if (v == null) return false;
//     return String(v).trim().length > 0;
//   };

//   const nonEmptyArray = (v) => Array.isArray(v) && v.filter(Boolean).length > 0;

//   const csvFromServices = (obj) => {
//     if (!obj || typeof obj !== "object") return null;
//     const vals = Object.values(obj).map(String).map((s) => s.trim()).filter(Boolean);
//     return vals.length ? vals.join(",") : null;
//   };

//   try {
//     // ---------- required ----------
//     if (!pipelineName) return res.status(400).json({ error: "pipelineName is required" });
//     if (!dataSourceType) return res.status(400).json({ error: "dataSourceType is required" });

//     // ---------- uniqueness check ----------
//     const checkSql = `
//       SELECT COUNT(*) AS count
//       FROM R_PIPELINE_METADATA_TBL
//       WHERE pipeline_name = ?
//     `;
//     const existingRows = await new Promise((resolve, reject) => {
//       connection.execute({
//         sqlText: checkSql,
//         binds: [pipelineName],
//         complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows)),
//       });
//     });

//     const count = existingRows?.[0]?.COUNT ?? existingRows?.[0]?.count ?? 0;
//     if (count > 0) {
//       return res.status(400).json({
//         success: false,
//         error: "Pipeline name already exists. Please choose a different name.",
//       });
//     }

//     const source = String(dataSourceType).toLowerCase(); // 'cloud' | 'database'
//     const mode = source === "cloud" ? "SEARCH" : source === "database" ? "ANALYST" : null;

//     // normalize fileType
//     const fileType = Array.isArray(selectedFiles)
//       ? selectedFiles.join(", ")
//       : (selectedFiles ?? null);

//     // ---------- validate by source ----------
//     if (source === "database") {
//       if (!selectedDb || !selectedSchema) {
//         return res.status(400).json({ error: "Database and schema are required for database sourceType" });
//       }

//       // ✅ OLD flow values normalized
//       const semanticViewCsv = toCsv(semanticView);
//       const semanticModelStr = nonEmptyString(semanticModel) ? String(semanticModel).trim() : null;

//       // ✅ NEW flow values normalized
//       const selectedTablesCsv = toCsv(selectedTables);
//       const servicesCsv = csvFromServices(createdSearchServices);

//       const hasOld = !!semanticViewCsv || !!semanticModelStr;
//       const hasNew = !!selectedTablesCsv || !!servicesCsv || (tableConfigs && typeof tableConfigs === "object");

//       // ✅ If new flow is used, derive semantic_view / semantic_model for storage
//       // semantic_view  = selected tables
//       // semantic_model = created service names
//       let finalSemanticView = semanticViewCsv;
//       let finalSemanticModel = semanticModelStr;

//       if (!hasOld && hasNew) {
//         finalSemanticView = selectedTablesCsv;         // ex: "SOCIALMEDIAPOSTS"
//         finalSemanticModel = servicesCsv;              // ex: "pipeline_CSVC_SOCIALMEDIAPOSTS"
//       }

//       // ✅ Final validation:
//       // For database we require at least ONE of these fields for the existing table schema.
//       // Also do NOT allow both old semanticView and old semanticModel simultaneously (old rule).
//       const oldHasView = !!semanticViewCsv;
//       const oldHasModel = !!semanticModelStr;

//       if (oldHasView && oldHasModel) {
//         return res.status(400).json({
//           error: "Provide exactly one: semanticView OR semanticModel for database sourceType",
//         });
//       }

//       if (!finalSemanticView && !finalSemanticModel) {
//         return res.status(400).json({
//           error: "For database sourceType, provide semanticView/semanticModel OR selectedTables/createdSearchServices",
//         });
//       }

//       // ---------- Insert ----------
//       const values = {
//         pipeline_name: pipelineName,
//         mode,
//         file_source_type: source.toUpperCase(),
//         database: selectedDb ?? null,
//         schema: selectedSchema ?? null,

//         // cloud fields -> null
//         file_location: null,
//         file_type: null,
//         chunking_method: null,
//         chunk_size: null,
//         chunk_overlap: null,
//         chunk_table: null,
//         cortex_search_service: null,

//         // ✅ store derived semantic fields for DB schema
//         semantic_view: finalSemanticView ?? null,
//         semantic_model: finalSemanticModel ?? null,

//         user_id: userId ?? null,
//       };

//       const sql = `
//         INSERT INTO R_PIPELINE_METADATA_TBL (
//           pipeline_name,
//           mode,
//           file_source_type,
//           database,
//           schema,
//           file_location,
//           file_type,
//           semantic_view,
//           semantic_model,
//           chunking_method,
//           chunk_size,
//           chunk_overlap,
//           chunk_table,
//           cortex_search_service,
//           user_id
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `;

//       const binds = [
//         values.pipeline_name,
//         values.mode,
//         values.file_source_type,
//         values.database,
//         values.schema,
//         values.file_location,
//         values.file_type,
//         values.semantic_view,
//         values.semantic_model,
//         values.chunking_method,
//         values.chunk_size,
//         values.chunk_overlap,
//         values.chunk_table,
//         values.cortex_search_service,
//         values.user_id,
//       ];

//       await new Promise((resolve, reject) => {
//         connection.execute({
//           sqlText: sql,
//           binds,
//           complete: (err) => (err ? reject(err) : resolve()),
//         });
//       });

//       return res.json({ success: true, message: "Pipeline submitted successfully" });
//     }

//     if (source === "cloud") {
//       if (!selectedDb || !selectedSchema) {
//         return res.status(400).json({ error: "Database and schema are required for cloud sourceType" });
//       }
//       if (!fileLocation) {
//         return res.status(400).json({ error: "fileLocation (stage) is required for cloud sourceType" });
//       }
//       if (!fileType) {
//         return res.status(400).json({ error: "file_type (selectedFiles) is required for cloud sourceType" });
//       }

//       const values = {
//         pipeline_name: pipelineName,
//         mode,
//         file_source_type: source.toUpperCase(),
//         database: selectedDb ?? null,
//         schema: selectedSchema ?? null,

//         file_location: fileLocation ?? null,
//         file_type: fileType ?? null,

//         semantic_view: null,
//         semantic_model: null,

//         chunking_method: chunkingMethod ?? null,
//         chunk_size: Number.isFinite(chunkSize) ? chunkSize : (chunkSize ?? null),
//         chunk_overlap: Number.isFinite(chunkOverlap) ? chunkOverlap : (chunkOverlap ?? null),
//         chunk_table: chunkTable ?? null,
//         cortex_search_service: cortexSearchService ?? null,

//         user_id: userId ?? null,
//       };

//       const sql = `
//         INSERT INTO R_PIPELINE_METADATA_TBL (
//           pipeline_name,
//           mode,
//           file_source_type,
//           database,
//           schema,
//           file_location,
//           file_type,
//           semantic_view,
//           semantic_model,
//           chunking_method,
//           chunk_size,
//           chunk_overlap,
//           chunk_table,
//           cortex_search_service,
//           user_id
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `;

//       const binds = [
//         values.pipeline_name,
//         values.mode,
//         values.file_source_type,
//         values.database,
//         values.schema,
//         values.file_location,
//         values.file_type,
//         values.semantic_view,
//         values.semantic_model,
//         values.chunking_method,
//         values.chunk_size,
//         values.chunk_overlap,
//         values.chunk_table,
//         values.cortex_search_service,
//         values.user_id,
//       ];

//       await new Promise((resolve, reject) => {
//         connection.execute({
//           sqlText: sql,
//           binds,
//           complete: (err) => (err ? reject(err) : resolve()),
//         });
//       });

//       return res.json({ success: true, message: "Pipeline submitted successfully" });
//     }

//     return res.status(400).json({ error: "dataSourceType must be 'cloud' or 'database'" });
//   } catch (err) {
//     console.error("Error inserting pipeline:", err); // ✅ log full error
//     return res.status(500).json({
//       success: false,
//       error: "Failed to submit pipeline",
//       message: err?.message || String(err),
//     });
//   }
// });

app.post("/api/submit-pipeline", async (req, res) => {
  const body = req.body || {};
  const {
    pipelineName,
    dataSourceType, // 'cloud' | 'database'
    selectedDb,
    selectedSchema,

    // SEARCH + CLOUD
    fileLocation,
    selectedFiles,
    chunkingMethod,
    chunkSize,
    chunkOverlap,
    chunkTable, // ignored for cloud storage now

    // SEARCH + DATABASE (Talk to Document DB)
    tableName,
    columnName,
    rowFilter,

    // SEARCH flows (both)
    cortexSearchService, // cloud ignored, db stored

    // ANALYST (Talk to Data)
    semanticView,
    semanticModel,

    userId,
  } = body;

  try {
    // --------------------------
    // 1. Basic required fields
    // --------------------------
    if (!pipelineName || !String(pipelineName).trim()) {
      return res.status(400).json({
        success: false,
        error: "pipelineName is required",
      });
    }

    if (!selectedDb || !selectedSchema) {
      return res.status(400).json({
        success: false,
        error: "Database and schema are required",
      });
    }

    const source = String(dataSourceType || "").toLowerCase(); // 'cloud' | 'database'
    if (source !== "cloud" && source !== "database") {
      return res.status(400).json({
        success: false,
        error: "dataSourceType must be 'cloud' or 'database'",
      });
    }

    // --------------------------
    // 2. Detect MODE (SEARCH / ANALYST)
    // --------------------------
    const hasSemanticView = Array.isArray(semanticView)
      ? semanticView.length > 0
      : typeof semanticView === "string"
        ? semanticView.trim() !== ""
        : false;

    const hasSemanticModel =
      typeof semanticModel === "string" && semanticModel.trim() !== "";

    // Cloud search: allow selectedFiles to be [] / empty (means "all files")
    const hasCloudSearch =
      !!fileLocation && selectedFiles !== undefined && selectedFiles !== null;

    const hasDbSearch = !!tableName && !!columnName && !!cortexSearchService;

    let mode = null; // SEARCH / ANALYST
    let fileSourceType = null; // CLOUD / DATABASE

    // ANALYST MODE (semantic view/model) — only valid when source is database
    if (hasSemanticView || hasSemanticModel) {
      if (source !== "database") {
        return res.status(400).json({
          success: false,
          error: "Semantic View/Model is only valid for database sourceType",
        });
      }

      if (
        (hasSemanticView && hasSemanticModel) ||
        (!hasSemanticView && !hasSemanticModel)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Provide exactly one: semanticModel OR semanticView for Analyst mode",
        });
      }

      mode = "ANALYST";
      fileSourceType = "DATABASE";
    }
    // SEARCH + CLOUD MODE
    else if (hasCloudSearch) {
      if (source !== "cloud") {
        return res.status(400).json({
          success: false,
          error: "Cloud search fields provided but dataSourceType is not cloud",
        });
      }

      mode = "SEARCH";
      fileSourceType = "CLOUD";
    }
    // SEARCH + DATABASE MODE
    else if (hasDbSearch) {
      if (source !== "database") {
        return res.status(400).json({
          success: false,
          error:
            "Database search fields provided but dataSourceType is not database",
        });
      }

      mode = "SEARCH";
      fileSourceType = "DATABASE";
    } else {
      return res.status(400).json({
        success: false,
        error:
          "Invalid request. Provide either CLOUD search fields, DB search fields (tableName/columnName/cortexSearchService), or semantic model/view fields.",
      });
    }

    // --------------------------
    // 3. Uniqueness check (global exact match, case-insensitive, trimmed)
    // --------------------------
    const normalizedPipelineName = String(pipelineName).trim();

    const checkSql = `
      SELECT COUNT(*) AS count
      FROM ${PIPELINE_METADATA_FQN}
      WHERE LOWER(TRIM(pipeline_name)) = LOWER(TRIM(?))
    `;

    const existing = await execWithBinds(checkSql, [normalizedPipelineName]);
    const exists = existing?.[0]?.COUNT ?? existing?.[0]?.count ?? 0;

    if (Number(exists) > 0) {
      return res.status(400).json({
        success: false,
        error: "Pipeline name already exists",
      });
    }

    // --------------------------
    // 4. Stream/Task only for SEARCH + CLOUD
    // --------------------------
    const stream =
      mode === "SEARCH" && fileSourceType === "CLOUD"
        ? "R_PIPELINE_STREAM"
        : null;

    const task =
      mode === "SEARCH" && fileSourceType === "CLOUD"
        ? "RAW_TEXT_PIPELINE_TASK"
        : null;

    const fileType = Array.isArray(selectedFiles)
      ? selectedFiles.join(", ")
      : (selectedFiles ?? null);

    const semanticViewStr = Array.isArray(semanticView)
      ? semanticView.join(", ")
      : (semanticView ?? null);

    // --------------------------
    // 5. Insert
    // --------------------------
    const insertSql = `
      INSERT INTO ${PIPELINE_METADATA_FQN} (
        pipeline_name,
        mode,
        file_source_type,
        database,
        schema,
        file_location,
        file_type,
        semantic_view,
        semantic_model,
        chunking_method,
        chunk_size,
        chunk_overlap,
        chunk_table,
        cortex_search_service,
        table_name,
        column_name,
        row_filter,
        stream,
        task,
        user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      normalizedPipelineName,
      mode,
      fileSourceType,

      selectedDb,
      selectedSchema,

      // file_location, file_type
      fileSourceType === "CLOUD" ? (fileLocation ?? null) : null,
      fileSourceType === "CLOUD" ? (fileType ?? null) : null,

      // semantic_view, semantic_model
      mode === "ANALYST" ? (semanticViewStr ?? null) : null,
      mode === "ANALYST" ? (semanticModel ?? null) : null,

      // chunking config (cloud only)
      mode === "SEARCH" && fileSourceType === "CLOUD"
        ? (chunkingMethod ?? null)
        : null,
      mode === "SEARCH" && fileSourceType === "CLOUD"
        ? chunkSize !== undefined && chunkSize !== null && chunkSize !== ""
          ? Number(chunkSize)
          : null
        : null,
      mode === "SEARCH" && fileSourceType === "CLOUD"
        ? chunkOverlap !== undefined &&
          chunkOverlap !== null &&
          chunkOverlap !== ""
          ? Number(chunkOverlap)
          : null
        : null,

      // chunk_table: store for cloud search
      mode === "SEARCH" && fileSourceType === "CLOUD"
        ? (chunkTable ?? null)
        : null,

      // cortex_search_service: store for both cloud and db search
      mode === "SEARCH" ? (cortexSearchService ?? null) : null,

      // table_name, column_name, row_filter (db search only)
      mode === "SEARCH" && fileSourceType === "DATABASE"
        ? (tableName ?? null)
        : null,
      mode === "SEARCH" && fileSourceType === "DATABASE"
        ? (columnName ?? null)
        : null,
      mode === "SEARCH" && fileSourceType === "DATABASE"
        ? (rowFilter ?? null)
        : null,

      // stream, task
      stream,
      task,

      userId ?? null,
    ];

    await execWithBinds(insertSql, values);

    return res.json({
      success: true,
      message: "Pipeline submitted successfully",
    });
  } catch (err) {
    console.error("Error inserting pipeline:", err);
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });

    return res.status(500).json({
      success: false,
      error: "Failed to submit pipeline",
      message: err?.message ?? String(err),
    });
  }
});

/**
 * GET /api/pipelines
 * Optional helper to verify data insertion and diagnose ECONNRESET on reads.
 */
app.get("/api/pipelines", async (_req, res) => {
  try {
    const rows = await execWithRetry(`
      SELECT PIPELINE_ID, PIPELINE_NAME, DATA_SOURCE, DATABASE_NAME, SCHEMA_NAME,
             STAGE_NAME, SELECTED_FILE, TABLE_NAME, MODE, CHUNKING_METHOD,
             CREATED_AT, USER_ID
      FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_PIPELINE_METADATA_TBL
      ORDER BY PIPELINE_ID DESC
      LIMIT 100
    `);

    return res.json({ success: true, pipelines: rows });
  } catch (err) {
    console.error("Failed to fetch pipelines:", err);
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    return res.status(500).json({
      success: false,
      error: "Failed to fetch pipelines",
      message: err?.message ?? String(err),
      code: err?.code ?? err?.errno ?? err?.name,
    });
  }
});

/*-----------update pipeline---------------*/

app.post("/api/update-pipeline", async (req, res) => {
  const body = req.body || {};
  if (!body.pipeline_id && body.pipelineId) body.pipeline_id = body.pipelineId;

  const {
    pipeline_id, // required
    pipeline_name,
    mode, // 'SEARCH' or 'ANALYST'
    file_source_type, // CLOUD | DATABASE
    database,
    schema,

    // CLOUD
    file_location,
    file_type,
    chunking_method,
    chunk_size,
    chunk_overlap,
    chunk_table,
    cortex_search_service,

    // DATABASE
    table_name,
    column_name,
    row_filter,

    // ANALYST
    semantic_view,
    semantic_model,

    // Infra
    stream,
    task,

    user_id,
  } = body;

  try {
    if (!pipeline_id) {
      return res
        .status(400)
        .json({ success: false, error: "pipeline_id is required" });
    }

    // --- Fetch existing row ---
    const fetchSql = `
      SELECT *
      FROM R_PIPELINE_METADATA_TBL
      WHERE pipeline_id = ?
    `;

    const existingRows = await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: fetchSql,
        binds: [pipeline_id],
        complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows)),
      });
    });

    if (!existingRows || existingRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Pipeline not found" });
    }

    const current = existingRows[0];

    // --------------------------------------------------
    // DUPLICATE NAME CHECK (ADD HERE)
    // --------------------------------------------------
    const nextPipelineName = String(
      pipeline_name ?? current.PIPELINE_NAME ?? "",
    ).trim();

    const currentPipelineName = String(current.PIPELINE_NAME ?? "").trim();

    // Only check duplicates if the name is actually being changed
    if (
      nextPipelineName &&
      nextPipelineName.toLowerCase() !== currentPipelineName.toLowerCase()
    ) {
      const duplicateSql = `
        SELECT COUNT(*) AS count
        FROM R_PIPELINE_METADATA_TBL
        WHERE LOWER(TRIM(pipeline_name)) = LOWER(TRIM(?))
          AND pipeline_id <> ?
      `;

      const duplicateRows = await new Promise((resolve, reject) => {
        connection.execute({
          sqlText: duplicateSql,
          binds: [nextPipelineName, pipeline_id],
          complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows)),
        });
      });

      const duplicateCount =
        duplicateRows?.[0]?.COUNT ?? duplicateRows?.[0]?.count ?? 0;

      if (Number(duplicateCount) > 0) {
        return res.status(400).json({
          success: false,
          error: "Pipeline name already exists",
        });
      }
    }

    // Normalize values (only override if provided)
    const finalValues = {
      pipeline_name: pipeline_name ?? current.PIPELINE_NAME,
      mode: mode ?? current.MODE,
      file_source_type: file_source_type ?? current.FILE_SOURCE_TYPE,
      database: database ?? current.DATABASE,
      schema: schema ?? current.SCHEMA,

      // CLOUD
      file_location: file_location ?? current.FILE_LOCATION,
      file_type: file_type ?? current.FILE_TYPE,
      chunking_method: chunking_method ?? current.CHUNKING_METHOD,
      chunk_size: chunk_size ?? current.CHUNK_SIZE,
      chunk_overlap: chunk_overlap ?? current.CHUNK_OVERLAP,
      chunk_table: chunk_table ?? current.CHUNK_TABLE,
      cortex_search_service:
        cortex_search_service ?? current.CORTEX_SEARCH_SERVICE,

      // DATABASE
      table_name: table_name ?? current.TABLE_NAME,
      column_name: column_name ?? current.COLUMN_NAME,
      row_filter: row_filter ?? current.ROW_FILTER,

      // ANALYST
      semantic_view: semantic_view ?? current.SEMANTIC_VIEW,
      semantic_model: semantic_model ?? current.SEMANTIC_MODEL,

      // Infra
      stream: stream ?? current.STREAM,
      task: task ?? current.TASK,
      user_id: user_id ?? current.USER_ID,
    };

    // --- Build update SQL ---
    const updateSql = `
      UPDATE R_PIPELINE_METADATA_TBL
      SET
        pipeline_name = ?,
        mode = ?,
        file_source_type = ?,
        database = ?,
        schema = ?,
        file_location = ?,
        file_type = ?,
        chunking_method = ?,
        chunk_size = ?,
        chunk_overlap = ?,
        chunk_table = ?,
        cortex_search_service = ?,
        table_name = ?,
        column_name = ?,
        row_filter = ?,
        semantic_view = ?,
        semantic_model = ?,
        stream = ?,
        task = ?,
        user_id = ?,
        updated_at = CURRENT_TIMESTAMP()
      WHERE pipeline_id = ?
    `;

    const binds = [
      finalValues.pipeline_name,
      finalValues.mode,
      finalValues.file_source_type,
      finalValues.database,
      finalValues.schema,
      finalValues.file_location,
      finalValues.file_type,
      finalValues.chunking_method,
      finalValues.chunk_size,
      finalValues.chunk_overlap,
      finalValues.chunk_table,
      finalValues.cortex_search_service,
      finalValues.table_name,
      finalValues.column_name,
      finalValues.row_filter,
      finalValues.semantic_view,
      finalValues.semantic_model,
      finalValues.stream,
      finalValues.task,
      finalValues.user_id,
      pipeline_id,
    ];

    await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: updateSql,
        binds,
        complete: (err, stmt) => (err ? reject(err) : resolve(stmt)),
      });
    });

    // --- Return updated row ---
    const fetchUpdated = `
      SELECT *
      FROM R_PIPELINE_METADATA_TBL
      WHERE pipeline_id = ?
    `;

    const updatedRows = await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: fetchUpdated,
        binds: [pipeline_id],
        complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows)),
      });
    });

    return res.json({
      success: true,
      message: "Pipeline updated successfully",
      pipeline: updatedRows[0],
    });
  } catch (err) {
    console.error("Error updating pipeline:", err?.message || err);
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });

    return res.status(500).json({
      success: false,
      error: "Failed to update pipeline",
    });
  }
});
``;

/* -------------------------- Analytics Endpoints ------------------------- */
// app.get("/api/total-conversations", async (req, res) => {
//   try {
//     const rows = await execQuery(`SELECT COUNT(*) AS TOTAL_CONVERSATIONS FROM R_SP_GENERATION_DATA`);
//     const totalConversations = rows[0].TOTAL_CONVERSATIONS ?? rows[0][0] ?? 0;
//     res.json({ totalConversations });
//   } catch (err) {
//     console.error("Error fetching total conversations:", err.message);
//     res.status(500).json({ error: "Failed to fetch total conversations" });
//   }
// });

app.get("/api/recommended-model", async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT model, AVG(norm_correctness) AS avg_correctness
      FROM R_SP_NORMALIZED_MODEL_METRICS
      WHERE model IS NOT NULL
      GROUP BY model
      ORDER BY avg_correctness DESC
      LIMIT 1
    `);
    const recommendedModel = rows[0].MODEL ?? rows[0][0] ?? "Unknown";
    res.json({
      recommendedModel,
      recommendationReason: `${recommendedModel} – Highest average correctness score.`,
    });
  } catch (err) {
    console.error("Error fetching recommended model:", err.message);
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    res.status(500).json({ error: "Failed to fetch recommended model" });
  }
});

app.get("/api/model-metrics-comparison", async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT * FROM R_SP_AVG_METRICS_BY_MODEL ORDER BY avg_correctness DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching model metrics comparison:", err.message);
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    res.status(500).json({ error: "Failed to fetch model metrics comparison" });
  }
});

// app.get("/api/csat-scores", async (req, res) => {
//   try {
//     const rows = await execQuery(`
//       SELECT model, ROUND(AVG(norm_coherence) * 100, 2) AS CSAT_SCORE
//       FROM R_SP_NORMALIZED_MODEL_METRICS
//       WHERE model IN ('llama3.1-70b','mistral-large2','llama3.1-8b')
//       GROUP BY model
//     `);
//     res.json(rows);
//   } catch (err) {
//     console.error("Error fetching CSAT scores:", err.message);
//     logAuditError({
//       eventType: "ERROR",
//       errorMessage: err.message || String(err),
//       context: JSON.stringify({
//         endpoint: req.originalUrl,
//         method: req.method,
//       }),
//       logDesc: "Failure in " + req.originalUrl,
//       userId: req.headers["x-user-id"] || "unknown",
//       querId: err.statementId || "UNKNOWN",
//     });
//     res.status(500).json({ error: "Failed to fetch CSAT scores" });
//   }
// });

// GET /api/correctness-monthly-split?from=2026-02-01&to=2026-02-18
app.get("/api/correctness-monthly-split", (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({
      error: "Missing required 'from' and 'to' query parameters",
    });
  }

  const sql = `
    WITH filtered AS (
      SELECT START_TIME, SQL_STATUS
      FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.AGENT_SQL_CORRECTNESS
      WHERE START_TIME::DATE BETWEEN TO_DATE(?) AND TO_DATE(?)
        AND SQL_STATUS IN ('OK', 'LIKELY HALLUCINATION')
    ),
    monthly AS (
      SELECT
        DATE_TRUNC('month', START_TIME)::DATE AS month_start,
        TO_CHAR(START_TIME, 'Mon')           AS month,
        COUNT(*)                               AS total_queries,
        COUNT_IF(SQL_STATUS = 'OK')            AS valid_cnt,
        COUNT_IF(SQL_STATUS = 'LIKELY HALLUCINATION') AS invalid_cnt
      FROM filtered
      GROUP BY 1, 2
    )
    SELECT
      month,
      ROUND(100.0 * valid_cnt  / NULLIF(total_queries, 0), 2) AS valid_pct,
      ROUND(100.0 * invalid_cnt/ NULLIF(total_queries, 0), 2) AS invalid_pct
    FROM monthly
    ORDER BY month_start
  `;

  connection.execute({
    sqlText: sql,
    binds: [from, to], // positional binds
    complete: (err, _stmt, rows) => {
      if (err) {
        console.error("Error fetching monthly correctness split:", err);
        return res
          .status(500)
          .json({ error: "Failed to fetch monthly correctness split" });
      }
      // rows like: [{ month: 'Jan', valid_pct: 66.67, invalid_pct: 33.33 }, ...]
      res.json(rows);
    },
  });
});

/* ---------------------------- Chunking Helpers -------------------------- */
function chunkTextFixed(text, size, overlap) {
  const chunks = [];
  let start = 0;
  const step = Math.max(1, size - (overlap ?? 0));
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    start += step;
  }
  return chunks;
}

function chunkTextRecursive(text) {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// server.js (updated API)

function normalizeParam(p) {
  return Array.isArray(p) ? p[0] : p;
}
function isAll(value) {
  return typeof value === "string" && value.trim().toUpperCase() === "ALL";
}

// app.get('/api/total_user', (req, res) => {
//   const chatbot_name = normalizeParam(req.query.chatbot_name);
//   const start_date   = normalizeParam(req.query.start_date);
//   const end_date     = normalizeParam(req.query.end_date);

//   const whereParts = [];
//   const binds = [];

//   if (chatbot_name && !isAll(chatbot_name)) {
//     whereParts.push('chatbot_name = ?');
//     binds.push(chatbot_name);
//   }
//   if (start_date && end_date) {
//     whereParts.push('start_time BETWEEN ? AND ?');
//     binds.push(start_date, end_date);
//   } else if (start_date) {
//     whereParts.push('start_time >= ?');
//     binds.push(start_date);
//   } else if (end_date) {
//     whereParts.push('start_time <= ?');
//     binds.push(end_date);
//   }

//   const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
//   const sql = `
//     SELECT COUNT(DISTINCT user_id) AS total_users
//     FROM MERGED_CHATBOT_DATA_TBL
//     ${whereClause};
//   `;

//   connection.execute({
//     sqlText: sql,
//     binds,
//     complete: (err, stmt, rows) => {
//       if (err) return res.status(500).json({ error: 'Error fetching data' });
//       const totalUsers = rows && rows.length ? Number(rows[0].TOTAL_USERS ?? rows[0].total_users ?? 0) : 0;
//       return res.json({ totalUsers });
//     },
//   });
// });

app.get("/api/total_user", (req, res) => {
  // Raw params
  const chatbot_name_raw = req.query.chatbot_name;
  const start_date_raw = req.query.start_date;
  const end_date_raw = req.query.end_date;

  // Normalize
  const chatbot_name = normalizeParam(chatbot_name_raw);
  const start_date = normalizeParam(start_date_raw);
  const end_date = normalizeParam(end_date_raw);

  // Robust "All" check
  const isAllSelected =
    !chatbot_name || String(chatbot_name).trim().toLowerCase() === "all";

  const whereParts = [];
  const binds = [];

  // Chatbot filter (only when not "All")
  if (!isAllSelected) {
    whereParts.push("r.chatbot_name = ?");
    binds.push(chatbot_name);
  }

  // Date filters: cast explicitly and make end date inclusive by adding 1 day
  // Expecting start_date/end_date from UI as 'YYYY-MM-DD' or ISO strings.
  // If only dates are provided (no time), this ensures inclusivity.
  if (start_date && end_date) {
    whereParts.push(`
      r1.start_time >= TRY_TO_TIMESTAMP_NTZ(?) 
      AND r1.start_time <  DATEADD(day, 1, TRY_TO_TIMESTAMP_NTZ(?))
    `);
    binds.push(start_date, end_date);
  } else if (start_date) {
    whereParts.push("r1.start_time >= TRY_TO_TIMESTAMP_NTZ(?)");
    binds.push(start_date);
  } else if (end_date) {
    // inclusive single-ended range
    whereParts.push("r1.start_time < DATEADD(day, 1, TRY_TO_TIMESTAMP_NTZ(?))");
    binds.push(end_date);
  }

  const whereClause = whereParts.length
    ? `WHERE ${whereParts.join(" AND ")}`
    : "";

  // Count distinct users from the response table joined to chatbots
  const sql = `
    SELECT COUNT(DISTINCT r.user_id) AS total_users
    FROM r_chatbots_tbl r
    JOIN r_chatbot_response_tbl r1
      ON r.chatbot_id = r1.chatbot_id
    ${whereClause};
  `;

  // --- TEMP DEBUG: log the final SQL and binds; remove after verification ---
  console.debug("[total_user] SQL:", sql);
  console.debug("[total_user] BINDS:", binds);

  connection.execute({
    sqlText: sql,
    binds,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("[total_user] Error:", err?.message || err);
        return res.status(500).json({ error: "Error fetching data" });
      }
      const totalUsers =
        rows && rows.length
          ? Number(rows[0].TOTAL_USERS ?? rows[0].total_users ?? 0)
          : 0;
      return res.json({ totalUsers });
    },
  });
});

app.get("/api/total_conversations", (req, res) => {
  const chatbot_name = normalizeParam(req.query.chatbot_name);
  const start_date = normalizeParam(req.query.start_date);
  const end_date = normalizeParam(req.query.end_date);

  const whereParts = [];
  const binds = [];

  // Filter by chatbot name only when a specific chatbot is selected
  if (chatbot_name && !isAll(chatbot_name)) {
    whereParts.push("r.chatbot_name = ?");
    binds.push(chatbot_name);
  }

  // Date filters on the response table
  if (start_date && end_date) {
    whereParts.push("r1.start_time BETWEEN ? AND ?");
    binds.push(start_date, end_date);
  } else if (start_date) {
    whereParts.push("r1.start_time >= ?");
    binds.push(start_date);
  } else if (end_date) {
    whereParts.push("r1.start_time <= ?");
    binds.push(end_date);
  }

  const whereClause = whereParts.length
    ? `WHERE ${whereParts.join(" AND ")}`
    : "";

  // IMPORTANT: place WHERE before the semicolon; not after.
  const sql = `
    SELECT COUNT(*) AS total_conversations
    FROM r_chatbots_tbl r
    JOIN r_chatbot_response_tbl r1
      ON r.chatbot_id = r1.chatbot_id
    ${whereClause};
  `;

  connection.execute({
    sqlText: sql,
    binds,
    complete: (err, stmt, rows) => {
      if (err) {
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        return res.status(500).json({ error: "Error fetching data" });
      }
      const total_conversations =
        rows && rows.length
          ? Number(
              rows[0].TOTAL_CONVERSATIONS ?? rows[0].total_conversations ?? 0,
            )
          : 0;
      return res.json({ total_conversations });
    },
  });
});

app.get("/api/adoption_rate", (req, res) => {
  const chatbot_name = normalizeParam(req.query.chatbot_name);
  const start_date = normalizeParam(req.query.start_date);
  const end_date = normalizeParam(req.query.end_date);

  const whereParts = [];
  const binds = [];

  // Chatbot filter (skip if "All")
  if (chatbot_name && !isAll(chatbot_name)) {
    whereParts.push("r.chatbot_name = ?");
    binds.push(chatbot_name);
  }

  // Date filters on response events (r1)
  // Note: this uses direct binds as you had; if you want inclusive end-date, see the note below.
  if (start_date && end_date) {
    whereParts.push("r1.start_time BETWEEN ? AND ?");
    binds.push(start_date, end_date);
  } else if (start_date) {
    whereParts.push("r1.start_time >= ?");
    binds.push(start_date);
  } else if (end_date) {
    whereParts.push("r1.start_time <= ?");
    binds.push(end_date);
  }

  const whereClause = whereParts.length
    ? `WHERE ${whereParts.join(" AND ")}`
    : "";

  const sql = `
    WITH num AS (
      SELECT COUNT(DISTINCT r1.user_id) AS distinct_users
      FROM r_chatbots_tbl r
      JOIN r_chatbot_response_tbl r1
        ON r.chatbot_id = r1.chatbot_id
      ${whereClause}
    ),
    denom AS (
      SELECT COUNT(*) AS total_users
      FROM SNOWFLAKE.ACCOUNT_USAGE.USERS
      WHERE deleted_on IS NULL
    )
    SELECT
      num.distinct_users AS numerator_distinct_users,
      denom.total_users   AS denominator_total_users,
      ROUND(100.0 * num.distinct_users / NULLIF(denom.total_users, 0), 4) AS adoption_rate
    FROM num CROSS JOIN denom
  `;

  connection.execute({
    sqlText: sql,
    binds,
    complete: (err, stmt, rows) => {
      if (err) return res.status(500).json({ error: "Error fetching data" });
      const row = rows && rows.length ? rows[0] : {};
      const numerator = Number(
        row.NUMERATOR_DISTINCT_USERS ?? row.numerator_distinct_users ?? 0,
      );
      const denominator = Number(
        row.DENOMINATOR_TOTAL_USERS ?? row.denominator_total_users ?? 0,
      );
      const rateRaw = row.ADOPTION_RATE ?? row.adoption_rate ?? null;
      const adoption_rate = rateRaw == null ? null : Number(rateRaw);
      return res.json({
        adoption_rate,
        numerator_distinct_users: numerator,
        denominator_total_users: denominator,
      });
    },
  });
});

app.get("/api/average_latency", (req, res) => {
  const chatbot_name = normalizeParam(req.query.chatbot_name);
  const start_date = normalizeParam(req.query.start_date);
  const end_date = normalizeParam(req.query.end_date);

  // Validate YYYY-MM-DD
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (start_date && !iso.test(start_date)) {
    return res.status(400).json({ error: "start_date must be YYYY-MM-DD" });
  }
  if (end_date && !iso.test(end_date)) {
    return res.status(400).json({ error: "end_date must be YYYY-MM-DD" });
  }

  const whereParts = [];
  const binds = [];

  // Chatbot filter (skip when "All")
  if (chatbot_name && !isAll(chatbot_name)) {
    whereParts.push("r.chatbot_name = ?");
    binds.push(chatbot_name);
  }

  // Date filters on r1.start_time (inclusive end_date)
  if (start_date && end_date) {
    whereParts.push(`
      r1.start_time >= TO_TIMESTAMP(?, 'YYYY-MM-DD')
      AND r1.start_time <  DATEADD(day, 1, TO_TIMESTAMP(?, 'YYYY-MM-DD'))
    `);
    binds.push(start_date, end_date);
  } else if (start_date) {
    whereParts.push(`r1.start_time >= TO_TIMESTAMP(?, 'YYYY-MM-DD')`);
    binds.push(start_date);
  } else if (end_date) {
    whereParts.push(
      `r1.start_time < DATEADD(day, 1, TO_TIMESTAMP(?, 'YYYY-MM-DD'))`,
    );
    binds.push(end_date);
  }

  const whereClause = whereParts.length
    ? `WHERE ${whereParts.join(" AND ")}`
    : "";

  // Compute average latency in ms, then format as HH:MM:SS.mmm using DATEADD on TIME literal (no TRY_* on TIMESTAMPs)
  const sql = `
    WITH diffs AS (
      SELECT
        CASE
          WHEN r1.start_time IS NOT NULL
           AND r1.end_time   IS NOT NULL
           AND r1.end_time  >= r1.start_time
          THEN DATEDIFF('millisecond', r1.start_time, r1.end_time)
        END AS diff_ms
      FROM r_chatbots_tbl r
      JOIN r_chatbot_response_tbl r1
        ON r.chatbot_id = r1.chatbot_id
      ${whereClause}
    ),
    agg AS (
      SELECT COALESCE(AVG(diff_ms), 0) AS avg_ms
      FROM diffs
    )
    SELECT
      avg_ms AS average_latency_ms,
      TO_VARCHAR(
        DATEADD('millisecond', ROUND(avg_ms), TIME '00:00:00'),
        'HH24:MI:SS.FF3'
      ) AS average_latency
    FROM agg
  `;

  connection.execute({
    sqlText: sql,
    binds,
    complete: (err, _stmt, rows) => {
      if (err) {
        // Return message so we can see exactly what Snowflake complains about
        return res
          .status(500)
          .json({ error: "Error fetching data", details: err.message });
      }
      const row = rows && rows.length ? rows[0] : {};
      const average_latency_ms = Number(
        row.AVERAGE_LATENCY_MS ?? row.average_latency_ms ?? 0,
      );
      const average_latency = String(
        row.AVERAGE_LATENCY ?? row.average_latency ?? "00:00:00.000",
      );

      return res.json({ average_latency, average_latency_ms });
    },
  });
});

app.get("/api/csat", async (req, res) => {
  try {
    const chatbot_name = normalizeParam(req.query.chatbot_name);
    const start_date = normalizeParam(req.query.start_date);
    const end_date = normalizeParam(req.query.end_date);

    const whereParts = ["r2.feedback_rating IS NOT NULL"];
    const binds = [];

    // Chatbot filter
    if (chatbot_name && !isAll(chatbot_name)) {
      whereParts.push("r.chatbot_name = ?");
      binds.push(chatbot_name);
    }

    // Date filters (on r1.start_time)
    if (start_date) {
      whereParts.push("CAST(r1.start_time AS DATE) >= TO_DATE(?)");
      binds.push(start_date);
    }

    if (end_date) {
      whereParts.push("CAST(r1.start_time AS DATE) <= TO_DATE(?)");
      binds.push(end_date);
    }

    const whereClause = `WHERE ${whereParts.join(" AND ")}`;

    // ⭐ FINAL QUERY — average of 1 and 0 directly
    const sql = `
      SELECT
        ROUND(AVG(r2.feedback_rating), 4) AS csat
      FROM r_chatbots_tbl r
      JOIN r_chatbot_response_tbl r1
        ON r.chatbot_id = r1.chatbot_id
      JOIN r_chatbot_feedback_tbl r2
        ON r1.response_id = r2.response_id
      ${whereClause}
    `;

    const rows = await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: sql,
        binds,
        complete: (err, stmt, rows) =>
          err ? reject(err) : resolve(rows ?? []),
      });
    });

    const csat =
      rows.length && rows[0].CSAT !== null ? Number(rows[0].CSAT) : 0; // only null if no rows matched

    return res.json({ csat });
  } catch (error) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: error.message || String(error),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: error.statementId || "UNKNOWN",
    });
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

app.get("/api/token_usage", (req, res) => {
  const chatbot_name = normalizeParam(req.query.chatbot_name);
  const start_date = normalizeParam(req.query.start_date);
  const end_date = normalizeParam(req.query.end_date);

  const whereParts = [];
  const binds = [];

  if (chatbot_name && !isAll(chatbot_name)) {
    whereParts.push("m.chatbot_name = ?");
    binds.push(chatbot_name);
  }
  if (start_date && end_date) {
    whereParts.push("r.start_time BETWEEN ? AND ?");
    binds.push(start_date, end_date);
  } else if (start_date) {
    whereParts.push("r.start_time >= ?");
    binds.push(start_date);
  } else if (end_date) {
    whereParts.push("r.start_time <= ?");
    binds.push(end_date);
  }

  const whereClause = whereParts.length
    ? `WHERE ${whereParts.join(" AND ")}`
    : "";
  const sql = `
    SELECT
      SUM(r.token_count) AS total_token_usage
    FROM R_chatbot_response_tbl r
    JOIN r_chatbots_tbl m
      ON r.chatbot_id = m.chatbot_id
    ${whereClause};
  `;

  connection.execute({
    sqlText: sql,
    binds,
    complete: (err, stmt, rows) => {
      if (err) return res.status(500).json({ error: "Error fetching data" });
      const total_token_usage =
        rows && rows.length
          ? Number(rows[0].TOTAL_TOKEN_USAGE ?? rows[0].total_token_usage ?? 0)
          : 0;
      return res.json({ total_token_usage });
    },
  });
});

app.get("/api/get_chatbots", (req, res) => {
  const query = `
    SELECT DISTINCT chatbot_name FROM r_chatbots_tbl
    ORDER BY chatbot_name
  `;
  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) return res.status(500).send("Error fetching chatbots");
      const names = [{ chatbot_name: "All", chatbot_id: null }].concat(
        (rows ?? []).map((r) => ({
          chatbot_name: r.CHATBOT_NAME,
          chatbot_id: r.CHATBOT_ID,
        })),
      );
      res.json(names);
    },
  });
});

app.get("/api/token_usage", (req, res) => {
  // Normalize potential arrays from req.query
  const chatbot_name = Array.isArray(req.query.chatbot_name)
    ? req.query.chatbot_name[0]
    : req.query.chatbot_name;
  const start_date = Array.isArray(req.query.start_date)
    ? req.query.start_date[0]
    : req.query.start_date;
  const end_date = Array.isArray(req.query.end_date)
    ? req.query.end_date[0]
    : req.query.end_date;

  const whereParts = [];
  const binds = [];

  if (chatbot_name) {
    // qualify to avoid ambiguity
    whereParts.push("m.chatbot_name = ?");
    binds.push(chatbot_name);
  }
  // Date filter on response start_time (qualify!)
  if (start_date && end_date) {
    whereParts.push("r.start_time BETWEEN ? AND ?");
    binds.push(start_date, end_date);
  } else if (start_date) {
    whereParts.push("r.start_time >= ?");
    binds.push(start_date);
  } else if (end_date) {
    whereParts.push("r.start_time <= ?");
    binds.push(end_date);
  }

  const whereClause = whereParts.length
    ? `WHERE ${whereParts.join(" AND ")}`
    : "";

  const sql = `
    SELECT
      SUM(r.token_count) AS total_token_usage
    FROM R_chatbot_response_tbl r
    JOIN r_chatbots_tbl m
      ON r.chatbot_id = m.chatbot_id
    ${whereClause};
  `;

  connection.execute({
    sqlText: sql,
    binds,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("Query failed:", err, "\nSQL:", sql, "\nBinds:", binds);
        return res.status(500).json({ error: "Error fetching data" });
      }

      const total_token_usage =
        rows && rows.length
          ? Number(rows[0].TOTAL_TOKEN_USAGE ?? rows[0].total_token_usage ?? 0)
          : 0;

      return res.json({ total_token_usage });
    },
  });
});

app.get("/api/csat_graph", (req, res) => {
  try {
    const chatbot_name = normalizeParam(req.query.chatbot_name);
    const start_date = normalizeParam(req.query.start_date);
    const end_date = normalizeParam(req.query.end_date);

    const whereParts = ["r2.feedback_rating IS NOT NULL"];
    const binds = [];

    // Chatbot filter
    if (chatbot_name && !isAll(chatbot_name)) {
      whereParts.push("r.chatbot_name = ?");
      binds.push(chatbot_name);
    }

    // Date filters (on r1.start_time)
    if (start_date && end_date) {
      whereParts.push(`
        CAST(r1.start_time AS DATE)
        BETWEEN TO_DATE(?) AND TO_DATE(?)
      `);
      binds.push(start_date, end_date);
    } else if (start_date) {
      whereParts.push(`CAST(r1.start_time AS DATE) >= TO_DATE(?)`);
      binds.push(start_date);
    } else if (end_date) {
      whereParts.push(`CAST(r1.start_time AS DATE) <= TO_DATE(?)`);
      binds.push(end_date);
    }

    const whereClause = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";

    // ⭐ EXACT query the user requested, with filters applied inside the CTE
    const sqlText = `
      WITH base AS (
        SELECT
          MONTHNAME(r1.start_time)      AS month,
          r2.feedback_rating::float     AS avg_feedback
        FROM r_chatbots_tbl r
        JOIN r_chatbot_response_tbl r1
          ON r.chatbot_id = r1.chatbot_id
        JOIN r_chatbot_feedback_tbl r2
          ON r1.response_id = r2.response_id
        ${whereClause}
      )
      SELECT
        month,
        ROUND(AVG(avg_feedback) * 100, 2) AS avg_feedback
      FROM base
      GROUP BY month
      ORDER BY month;
    `;

    connection.execute({
      sqlText,
      binds,
      complete: (err, stmt, rows) => {
        if (err) {
          console.error("CSAT graph query failed:", err);
          logAuditError({
            eventType: "ERROR",
            errorMessage: err.message || String(err),
            context: JSON.stringify({
              endpoint: req.originalUrl,
              method: req.method,
            }),
            logDesc: "Failure in " + req.originalUrl,
            userId: req.headers["x-user-id"] || "unknown",
            querId: err.statementId || "UNKNOWN",
          });
          return res.status(500).json({ error: "Failed to fetch CSAT graph" });
        }

        const payload = (rows || []).map((r) => ({
          month: r.MONTH ?? r.month,
          avg_feedback: Number(r.AVG_FEEDBACK ?? r.avg_feedback ?? 0),
        }));

        return res.json({ data: payload });
      },
    });
  } catch (e) {
    console.error("Unexpected error in /api/csat_graph:", e);
    res.status(500).json({ error: "Unexpected server error" });
  }
});
app.get("/api/monthly_users", (req, res) => {
  try {
    const chatbot_name = normalizeParam(req.query.chatbot_name);
    const start_date = normalizeParam(req.query.start_date);
    const end_date = normalizeParam(req.query.end_date);

    const whereParts = [];
    const binds = [];

    // Chatbot filter (skip when "All")
    if (chatbot_name && !isAll(chatbot_name)) {
      whereParts.push("r.chatbot_name = ?");
      binds.push(chatbot_name);
    }

    // Date filters on r1.start_time
    if (start_date && end_date) {
      whereParts.push(`
        CAST(r1.start_time AS DATE)
        BETWEEN TO_DATE(?) AND TO_DATE(?)
      `);
      binds.push(start_date, end_date);
    } else if (start_date) {
      whereParts.push(`CAST(r1.start_time AS DATE) >= TO_DATE(?)`);
      binds.push(start_date);
    } else if (end_date) {
      whereParts.push(`CAST(r1.start_time AS DATE) <= TO_DATE(?)`);
      binds.push(end_date);
    }

    const whereClause = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";

    // NEW SQL using MONTHNAME() exactly like your requirement
    const sqlText = `
      SELECT
        MONTHNAME(r1.start_time)              AS month_name,
        COUNT(DISTINCT r.user_id)            AS count
      FROM r_chatbots_tbl r
      JOIN r_chatbot_response_tbl r1
        ON r.chatbot_id = r1.chatbot_id
      ${whereClause}
      GROUP BY month_name;
    `;

    connection.execute({
      sqlText,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) {
          logAuditError({
            eventType: "ERROR",
            errorMessage: err.message || String(err),
            context: JSON.stringify({
              endpoint: req.originalUrl,
              method: req.method,
            }),
            logDesc: "Failure in " + req.originalUrl,
            userId: req.headers["x-user-id"] || "unknown",
            querId: err.statementId || "UNKNOWN",
          });
          return res.status(500).json({
            error: "Failed to fetch monthly users",
            details: err.message,
          });
        }

        const data = rows.map((r) => ({
          month: r.MONTH_NAME ?? r.month_name,
          count: Number(r.COUNT ?? r.count),
        }));

        return res.json(data);
      },
    });
  } catch (e) {
    res.status(500).json({ error: "Unexpected server error" });
  }
});

app.get("/api/token_usage_by_month", (req, res) => {
  const normalizeParam = (v) =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const isAll = (v) =>
    typeof v === "string" && v.trim().toUpperCase() === "ALL";

  const chatbot_name = normalizeParam(req.query.chatbot_name);
  const start_date = normalizeParam(req.query.start_date);
  const end_date = normalizeParam(req.query.end_date);

  if (!start_date || !end_date) {
    return res.status(400).json({
      error:
        "Missing required query params: start_date and end_date (YYYY-MM-DD)",
    });
  }

  const whereParts = [];
  const binds = [];

  // Date window on response timestamps: inclusive start, exclusive end (+1 day)
  whereParts.push("DATE(c.start_time) >= TO_DATE(?)");
  binds.push(start_date);
  whereParts.push("DATE(c.start_time) < DATEADD('day', 1, TO_DATE(?))");
  binds.push(end_date);

  // Chatbot filter via name (only when not ALL)
  if (chatbot_name && !isAll(chatbot_name)) {
    // If names can vary slightly, use ILIKE with %...%
    whereParts.push("m.chatbot_name = ?");
    binds.push(chatbot_name);
    // For partial matches, replace the two lines above with:
    // whereParts.push('m.chatbot_name ILIKE ?');
    // binds.push(`%${chatbot_name}%`);
  }

  const whereClause = `WHERE ${whereParts.join(" AND ")}`;

  const sql = `
    SELECT
      MONTHNAME(c.start_time)       AS MONTH_LABEL,          -- e.g., 'January'
      EXTRACT(YEAR  FROM c.start_time) AS YEAR_NUM,
      EXTRACT(MONTH FROM c.start_time) AS MONTH_NUM,
      SUM(COALESCE(c.token_count, 0)) AS TOTAL_TOKEN_USAGE
    FROM r_chatbots_tbl m
    JOIN R_chatbot_response_tbl c
      ON m.chatbot_id = c.chatbot_id
    ${whereClause}
    GROUP BY MONTH_LABEL, YEAR_NUM, MONTH_NUM
    ORDER BY YEAR_NUM, MONTH_NUM;
  `;

  connection.execute({
    sqlText: sql,
    binds,
    complete: (err, stmt, rows) => {
      if (err) {
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        console.error("token_usage_by_month failed:", err && err.message);
        try {
          if (stmt && typeof stmt.getSqlText === "function")
            console.error("SQL:", stmt.getSqlText());
          if (stmt && typeof stmt.getQueryId === "function")
            console.error("QueryId:", stmt.getQueryId());
        } catch {}
        return res
          .status(500)
          .json({ error: "Error fetching token usage by month" });
      }

      const data = (rows || []).map((r) => ({
        month_label: (r.MONTH_LABEL || "").trim(),
        year_num: Number(r.YEAR_NUM ?? null),
        month_num: Number(r.MONTH_NUM ?? null),
        total_token_usage: Number(r.TOTAL_TOKEN_USAGE ?? 0),
      }));

      res.json({ data });
    },
  });
});

//model-comparison

// app.get("/api/avg-metrics", (req, res) => {
//   const sql = `SELECT * FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_SP_AVG_METRICS_BY_MODEL`;

//   connection.execute({
//     sqlText: sql,
//     complete: (err, _stmt, rows) => {
//       if (err) {
//         console.error("Error fetching metrics:", err);
//         return res.status(500).json({ error: "Failed to fetch data" });
//       }
//       res.json(rows); // Send raw rows
//     },
//   });
// });

// Simple CSAT API using existing Snowflake `connection`
// app.get("/api/csat-scores", (req, res) => {
//   const query = `
//     SELECT
//       MODEL,
//       ROUND(AVG(NORM_COHERENCE) * 100, 2) AS CSAT_SCORE
//     FROM R_SP_NORMALIZED_MODEL_METRICS
//     GROUP BY MODEL
//     ORDER BY CSAT_SCORE DESC
//   `;

//   connection.execute({
//     sqlText: query,
//     binds: [], // no parameters
//     complete: (err, stmt, rows) => {
//       if (err) {
//         console.error("Error fetching CSAT scores:", err);
//         return res.status(500).json({ error: "Failed to fetch CSAT scores" });
//       }
//       // rows will look like: [{ MODEL: 'Llama 3.0', CSAT_SCORE: 86.25 }, ...]
//       res.json(rows || []);
//     },
//   });
// });

app.get("/api/mc/all-metrics", (req, res) => {
  const modelsParam = req.query.models || "ALL";
  const safeModels = modelsParam.replace(/'/g, "''");
  const sql = `CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.SP_MODEL_COMPARISON_METRICS('${safeModels}')`;
  connection.execute({
    sqlText: sql,
    complete: (err, stmt, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      // Safely handle string or already-parsed object from Snowflake
      const metricsRaw = rows?.[0]?.SP_MODEL_COMPARISON_METRICS;
      if (typeof metricsRaw === "string") {
        try {
          return res.json(JSON.parse(metricsRaw));
        } catch (parseErr) {
          console.error(
            "Failed to parse SP_MODEL_COMPARISON_METRICS:",
            parseErr,
            metricsRaw,
          );
          return res.status(500).json({ error: "Failed to parse metrics" });
        }
      }
      // Already an object/variant — return as-is
      return res.json(metricsRaw);
    },
  });
});

// ---------- API: Success rate ----------

// /api/success-rate
// app.get('/api/success-rate', async (req, res) => {
//   const sql = `
//     SELECT ROUND((COUNT_IF(norm_correctness > 0.8) / COUNT(*)) * 100, 2) AS SUCCESS_RATE_PERCENT
//     FROM R_SP_NORMALIZED_MODEL_METRICS
//   `;
//   try {
//     const rows = await execSQL(sql);
//     const val = rows?.[0]?.SUCCESS_RATE_PERCENT;
//     // Ensure numeric (Snowflake SDK often returns strings)
//     res.json({ successRatePercent: Number(val ?? 0) });
//   } catch (error) {
//     console.error('Error fetching success rate:', error);
//     res.status(500).json({ error: 'Failed to fetch success rate' });
//   }
// });

// ---------- API: Total conversations for model comparision ----------
// app.get('/api/total-conversations', async (req, res) => {
//   const sql = `
//     SELECT COUNT(*) AS TOTAL_CONVERSATIONS
//     FROM R_SP_GENERATION_DATA
//   `;
//   try {
//     const rows = await execSQL(sql);
//     const val = rows?.[0]?.TOTAL_CONVERSATIONS;
//     res.json({ totalConversations: Number(val ?? 0) });
//   } catch (error) {
//     console.error('Error fetching total conversations:', error);
//     res.status(500).json({ error: 'Failed to fetch total conversations' });
//   }
// });

/// ---- 2) Reusable runQuery helper ----
export function runQuery(sqlText, binds = []) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, stmt, rows) => {
        if (err) {
          console.error("SQL error:", err.message);
          console.error("SQL text:", sqlText);
          console.error("Binds:", binds);
          return reject(err);
        }
        resolve(rows);
      },
    });
  });
}

// === Owner filter as requested ===
const SERVICE_OWNER_EQ = "RAISE_CAP_DOC_1";

// ---- 4) Services list (owner scoped) ----
app.get("/api/services", async (req, res) => {
  try {
    const sql = `
      SELECT DISTINCT SERVICE_NAME
      FROM SNOWFLAKE.ACCOUNT_USAGE.SERVICES
      WHERE SERVICE_OWNER = '${SERVICE_OWNER_EQ}'
        AND SERVICE_NAME IS NOT NULL
        AND DELETED IS NULL
      ORDER BY SERVICE_NAME
    `;
    const rows = await runQuery(sql);
    const list = Array.isArray(rows)
      ? rows.map((r) => r.SERVICE_NAME).filter(Boolean)
      : [];
    res.json(list); // frontend will prepend "ALL" option
  } catch (e) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: e.message || String(e),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: e.statementId || "UNKNOWN",
    });
    console.error("GET /services error:", e);
    res
      .status(500)
      .json({ error: "Failed to fetch services", detail: String(e) });
  }
});

app.get("/api/spcs/cost-trend", async (req, res) => {
  try {
    let { serviceName, startDate, endDate, viewBy = "daily" } = req.query;
    if (!serviceName || !startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "serviceName, startDate, endDate are required" });
    }

    const rate = parseFloat(process.env.CREDIT_RATE_USD || "2.00");
    const isAll = String(serviceName).trim().toUpperCase() === "ALL";
    const granularity =
      String(viewBy).toLowerCase() === "monthly" ? "month" : "day";
    const binds = [startDate, endDate];

    // NOTE: We do NOT owner-filter in svc_all for 'services_present' correctness.
    // Owner scoping is applied in the final SELECT by service_id/service_name.
    let sql = `
      WITH hist AS (
        SELECT
          START_TIME::TIMESTAMP_LTZ AS ts_hour,
          COMPUTE_POOL_NAME,
          CREDITS_USED
        FROM SNOWFLAKE.ACCOUNT_USAGE.SNOWPARK_CONTAINER_SERVICES_HISTORY
        WHERE START_TIME >= ?::TIMESTAMP
          AND START_TIME < (?::TIMESTAMP + INTERVAL '1 day')
      ),
      svc_all AS (
        SELECT
          SERVICE_ID,
          SERVICE_NAME,
          COMPUTE_POOL_NAME,
          CREATED,
          DELETED,
          SERVICE_OWNER
        FROM SNOWFLAKE.ACCOUNT_USAGE.SERVICES
      ),
      eligible AS (
        SELECT
          h.ts_hour,
          h.compute_pool_name,
          h.credits_used,
          s.service_id,
          s.service_name,
          s.service_owner
        FROM hist h
        JOIN svc_all s
          ON s.compute_pool_name = h.compute_pool_name
         AND h.ts_hour >= s.created
         AND (s.deleted IS NULL OR h.ts_hour <= s.deleted)
      ),
      per_hour AS (
        SELECT
          ts_hour,
          DATE_TRUNC('${granularity}', ts_hour) AS bucket_ts,
          compute_pool_name,
          credits_used,
          service_id,
          service_name,
          COUNT(*) OVER (PARTITION BY ts_hour, compute_pool_name) AS services_present
        FROM eligible
      ),
      alloc_hour AS (
        SELECT
          bucket_ts,
          service_id,
          service_name,
          credits_used / NULLIF(services_present, 0) AS credits_allocated_hour
        FROM per_hour
      )
    `;

    if (isAll) {
      // All services owned by SERVICE_OWNER_EQ
      sql += `
        SELECT
          bucket_ts,
          SUM(credits_allocated_hour) AS credits_bucket
        FROM alloc_hour a
        WHERE a.service_id IN (
          SELECT SERVICE_ID FROM SNOWFLAKE.ACCOUNT_USAGE.SERVICES
          WHERE SERVICE_OWNER = '${SERVICE_OWNER_EQ}'
        )
        GROUP BY bucket_ts
        ORDER BY bucket_ts;
      `;
    } else {
      // Single service by name (still uses correct global denominator)
      sql += `
        SELECT
          bucket_ts,
          SUM(credits_allocated_hour) AS credits_bucket
        FROM alloc_hour a
        WHERE UPPER(a.service_name) = UPPER(?)
          AND a.service_id IN (
            SELECT SERVICE_ID FROM SNOWFLAKE.ACCOUNT_USAGE.SERVICES
            WHERE SERVICE_OWNER = '${SERVICE_OWNER_EQ}'
          )
        GROUP BY bucket_ts
        ORDER BY bucket_ts;
      `;
      binds.push(String(serviceName).trim());
    }

    const rows = await runQuery(sql, binds);

    res.json(
      rows.map((r) => ({
        bucket: r.BUCKET_TS,
        credits: Number(r.CREDITS_BUCKET || 0),
        costUsd: Number(r.CREDITS_BUCKET || 0) * rate,
      })),
    );
  } catch (e) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: e.message || String(e),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: e.statementId || "UNKNOWN",
    });
    console.error("trend error:", e);
    res
      .status(500)
      .json({ error: "Failed to fetch cost trend", detail: String(e) });
  }
});

app.get("/api/spcs/total-cost", async (req, res) => {
  try {
    let { serviceName, startDate, endDate } = req.query;
    if (!serviceName || !startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "serviceName, startDate, endDate are required" });
    }

    const rate = parseFloat(process.env.CREDIT_RATE_USD || "2.00");
    const isAll = String(serviceName).trim().toUpperCase() === "ALL";
    const binds = [startDate, endDate];

    let sql = `
      WITH hist AS (
        SELECT
          START_TIME::TIMESTAMP_LTZ AS ts_hour,
          COMPUTE_POOL_NAME,
          CREDITS_USED
        FROM SNOWFLAKE.ACCOUNT_USAGE.SNOWPARK_CONTAINER_SERVICES_HISTORY
        WHERE START_TIME >= ?::TIMESTAMP
          AND START_TIME < (?::TIMESTAMP + INTERVAL '1 day')
      ),
      svc_all AS (
        SELECT
          SERVICE_ID,
          SERVICE_NAME,
          COMPUTE_POOL_NAME,
          CREATED,
          DELETED,
          SERVICE_OWNER
        FROM SNOWFLAKE.ACCOUNT_USAGE.SERVICES
      ),
      eligible AS (
        SELECT
          h.ts_hour,
          h.compute_pool_name,
          h.credits_used,
          s.service_id,
          s.service_name,
          s.service_owner
        FROM hist h
        JOIN svc_all s
          ON s.compute_pool_name = h.compute_pool_name
         AND h.ts_hour >= s.created
         AND (s.deleted IS NULL OR h.ts_hour <= s.deleted)
      ),
      per_hour AS (
        SELECT
          ts_hour,
          compute_pool_name,
          credits_used,
          service_id,
          service_name,
          COUNT(*) OVER (PARTITION BY ts_hour, compute_pool_name) AS services_present
        FROM eligible
      ),
      alloc_hour AS (
        SELECT
          service_id,
          service_name,
          credits_used / NULLIF(services_present, 0) AS credits_allocated_hour
        FROM per_hour
      )
    `;

    if (isAll) {
      sql += `
        SELECT COALESCE(SUM(credits_allocated_hour), 0) AS credits_total
        FROM alloc_hour a
        WHERE a.service_id IN (
          SELECT SERVICE_ID FROM SNOWFLAKE.ACCOUNT_USAGE.SERVICES
          WHERE SERVICE_OWNER = '${SERVICE_OWNER_EQ}'
        );
      `;
    } else {
      sql += `
        SELECT COALESCE(SUM(credits_allocated_hour), 0) AS credits_total
        FROM alloc_hour a
        WHERE UPPER(a.service_name) = UPPER(?)
          AND a.service_id IN (
            SELECT SERVICE_ID FROM SNOWFLAKE.ACCOUNT_USAGE.SERVICES
            WHERE SERVICE_OWNER = '${SERVICE_OWNER_EQ}'
          );
      `;
      binds.push(String(serviceName).trim());
    }

    const [r] = await runQuery(sql, binds);
    const credits = Number(r?.CREDITS_TOTAL || 0);
    res.json({ creditsTotal: credits, costUsdTotal: credits * rate });
  } catch (e) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: e.message || String(e),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: e.statementId || "UNKNOWN",
    });
    console.error("total-cost error:", e);
    res
      .status(500)
      .json({ error: "Failed to fetch total cost", detail: String(e) });
  }
});
// ---- 8) SPCS: distribution across owner's services ----

app.get("/api/spcs/distribution", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate, endDate are required" });
    }
    const rate = parseFloat(process.env.CREDIT_RATE_USD || "2.00");
    const binds = [startDate, endDate];

    const sql = `
      WITH hist AS (
        SELECT
          START_TIME::TIMESTAMP_LTZ AS ts_hour,
          COMPUTE_POOL_NAME,
          CREDITS_USED
        FROM SNOWFLAKE.ACCOUNT_USAGE.SNOWPARK_CONTAINER_SERVICES_HISTORY
        WHERE START_TIME >= ?::TIMESTAMP
          AND START_TIME < (?::TIMESTAMP + INTERVAL '1 day')
      ),
      svc_all AS (
        SELECT
          SERVICE_ID,
          SERVICE_NAME,
          COMPUTE_POOL_NAME,
          CREATED,
          DELETED,
          SERVICE_OWNER
        FROM SNOWFLAKE.ACCOUNT_USAGE.SERVICES
      ),
      eligible AS (
        SELECT
          h.ts_hour,
          h.compute_pool_name,
          h.credits_used,
          s.service_id,
          s.service_name,
          s.service_owner
        FROM hist h
        JOIN svc_all s
          ON s.compute_pool_name = h.compute_pool_name
         AND h.ts_hour >= s.created
         AND (s.deleted IS NULL OR h.ts_hour <= s.deleted)
      ),
      per_hour AS (
        SELECT
          ts_hour,
          compute_pool_name,
          credits_used,
          service_id,
          service_name,
          COUNT(*) OVER (PARTITION BY ts_hour, compute_pool_name) AS services_present
        FROM eligible
      ),
      alloc_hour AS (
        SELECT
          service_id,
          service_name,
          credits_used / NULLIF(services_present, 0) AS credits_allocated_hour
        FROM per_hour
      )
      SELECT
        a.service_name,
        COALESCE(SUM(a.credits_allocated_hour), 0) AS credits_total
      FROM alloc_hour a
      WHERE a.service_id IN (
        SELECT SERVICE_ID FROM SNOWFLAKE.ACCOUNT_USAGE.SERVICES
        WHERE SERVICE_OWNER = '${SERVICE_OWNER_EQ}'
      )
      GROUP BY a.service_name
      HAVING COALESCE(SUM(a.credits_allocated_hour), 0) > 0
      ORDER BY credits_total DESC;
    `;

    const rows = await runQuery(sql, binds);
    res.json(
      rows.map((r) => ({
        serviceName: r.SERVICE_NAME,
        creditsTotal: Number(r.CREDITS_TOTAL || 0),
        costUsdTotal: Number(r.CREDITS_TOTAL || 0) * rate,
      })),
    );
  } catch (e) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: e.message || String(e),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: e.statementId || "UNKNOWN",
    });
    console.error("distribution error:", e);
    res
      .status(500)
      .json({ error: "Failed to fetch distribution", detail: String(e) });
  }
});
// Calls your stored procedure to send email
app.post("/api/notify-failed-audits", async (req, res) => {
  try {
    const sql = `CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.SEND_FAILED_AUDIT_LOG_EMAIL();`;
    const result = await executeQuery(sql);
    return res.status(200).json({
      ok: true,
      message:
        "Email notification triggered successfully check you mail for latest error.",
      result,
    });
  } catch (err) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    console.error("notify-failed-audits error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to trigger email notification.",
    });
  }
});

app.post("/api/compliances", (req, res) => {
  const { complianceName, pipelineId } = req.body;
  if (!complianceName || !pipelineId) {
    return res.status(400).json({
      success: false,
      data: null,
      error: "VALIDATION_ERROR",
      message: "complianceName and pipelineId are required",
    });
  }

  const query = ` 
	INSERT INTO R_COMPLIANCE_CHECKS_TABLE (COMPLIANCE_NAME, PIPELINE_ID, CREATED_AT) 
	VALUES (?, ?, CURRENT_TIMESTAMP()) 
  `;
  connection.execute({
    sqlText: query,
    binds: [complianceName, pipelineId],
    complete: (err) => {
      if (err) {
        console.error("Insert failed: " + err.message);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        res.status(500).json({
          success: false,
          data: null,
          error: "DATABASE_ERROR",
          message: "Failed to insert compliance into database",
        });
      } else {
        res.json({
          success: true,
          data: {
            complianceName,
            pipelineId,
            createdAt: new Date().toISOString(),
          },
          message: "Compliance created successfully",
        });
      }
    },
  });
});

// GET /api/ai/total-conversations
// app.get("/api/total-conversations", async (_req, res) => {
//   try {
//     const sql = `
//       SELECT
//         COUNT(DISTINCT RECORD_ATTRIBUTES:"snow.ai.observability.session.id"::string) AS total_conversations
//       FROM snowflake.local.ai_observability_events
//       WHERE RECORD_ATTRIBUTES:"snow.ai.observability.session.id" IS NOT NULL;
//     `;
//
//     const rows = await runQuery(sql);
//
//     // Snowflake returns uppercase column keys by default.
//     const total = rows?.[0]?.TOTAL_CONVERSATIONS ?? 0;
//     res.status(200).json({ total_conversations: Number(total) });
//   } catch (error) {
//     console.error("Error executing total-conversations query:", error);
//     logAuditError({
//       eventType: "ERROR",
//       errorMessage: error.message || String(error),
//       context: JSON.stringify({
//         endpoint: _req.originalUrl,
//         method: _req.method,
//       }),
//       logDesc: "Failure in " + _req.originalUrl,
//       userId: _req.headers["x-user-id"] || "unknown",
//       querId: error.statementId || "UNKNOWN",
//     });
//     res.status(500).json({
//       error: "Failed to fetch total conversations",
//       details: error.message || String(error),
//     });
//   }
// });

// app.get("/api/success-rate", async (_req, res) => {
//   try {
//     const sql = `
//       WITH spans AS (
//         SELECT
//           COALESCE(
//             RECORD_ATTRIBUTES:"snow.ai.observability.object.name"::string,
//             RECORD_ATTRIBUTES:"thread.name"::string,
//             RECORD_ATTRIBUTES:"ai.observability.run.name"::string
//           ) AS agent_name_raw,
//
//           COALESCE(
//             RECORD_ATTRIBUTES:"snow.ai.observability.agent.status.code"::string,
//             RECORD_ATTRIBUTES:"ai.observability.agent.status.code"::string,
//             RECORD:"status":"code"::string
//           ) AS status_code_raw,
//
//           TRY_TO_NUMBER(
//             COALESCE(
//               RECORD_ATTRIBUTES:"snow.ai.observability.agent.status.code"::string,
//               RECORD_ATTRIBUTES:"ai.observability.agent.status.code"::string,
//               RECORD:"status":"code"::string
//             )
//           ) AS status_code_num
//         FROM SNOWFLAKE.LOCAL.AI_OBSERVABILITY_EVENTS
//         WHERE RECORD_TYPE = 'SPAN'
//       )
//       SELECT
//         ROUND(
//           (
//             COUNT_IF(
//               UPPER(status_code_raw) IN ('OK','SUCCESS','STATUS_CODE_OK')
//               OR status_code_num = 0
//             ) * 100.0
//           ) / NULLIF(COUNT(*), 0),
//           2
//         ) AS success_rate_percent
//       FROM spans
//       WHERE UPPER(agent_name_raw) = 'UNSTRUCTURED_DATA';
//     `;
//
//     const rows = await runQuery(sql);
//     const successRate = rows?.[0]?.SUCCESS_RATE_PERCENT ?? 0;
//
//     return res.json({ success_rate_percent: Number(successRate) });
//   } catch (error) {
//     logAuditError({
//       eventType: "ERROR",
//       errorMessage: error.message || String(error),
//       context: JSON.stringify({
//         endpoint: _req.originalUrl,
//         method: _req.method,
//       }),
//       logDesc: "Failure in " + _req.originalUrl,
//       userId: _req.headers["x-user-id"] || "unknown",
//       querId: error.statementId || "UNKNOWN",
//     });
//     console.error("Error fetching success rate:", error);
//     return res.status(500).json({
//       error: "Failed to fetch success rate",
//       details: error.message || String(error),
//     });
//   }
// });

app.get("/api/compliances", (req, res) => {
  const query = `
    SELECT
      REGULATION_ID,
      REGULATION_NAME,
      PIPELINE_ID,
      CRETAED_BY AS CREATED_BY,  -- alias covers the typo if not yet renamed
      CREATED_AT,
      REGULATIONTYPE,
      INPUTCONTROL
    FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.DIM_REGULATION
    ORDER BY CREATED_AT DESC
  `;

  connection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      const query_id = stmt?.getStatementId?.() || null;

      if (err) {
        console.error("Query failed:", err.message, {
          code: err.code,
          sqlState: err.sqlState,
          query_id,
        });
        return res.status(500).json({
          success: false,
          data: null,
          error: "DATABASE_ERROR",
          message: "Failed to fetch compliances",
          diagnostics: {
            code: err.code ?? null,
            sqlState: err.sqlState ?? null,
            message: err.message ?? null,
            query_id,
          },
        });
      }

      res.json({
        success: true,
        data: rows,
        message: "Compliances fetched successfully",
        query_id,
      });
    },
  });
});

// app.post("/api/create-compliances", (req, res) => {
//   const { regulationName, pipelineId } = req.body || {};

//   // ---- Validation: regulationName ----
//   if (!regulationName || typeof regulationName !== "string" || !regulationName.trim()) {
//     return res.status(400).json({
//       success: false,
//       error: "BAD_REQUEST",
//       message: "regulationName is required and must be a non-empty string",
//     });
//   }

//   // ---- Validation: pipelineId (must be positive integer) ----
//   let pipelineIdNum;
//   if (typeof pipelineId === "number") {
//     pipelineIdNum = pipelineId;
//   } else if (typeof pipelineId === "string") {
//     const trimmed = pipelineId.trim();
//     if (!trimmed) {
//       return res.status(400).json({
//         success: false,
//         error: "BAD_REQUEST",
//         message: "pipelineId is required and must be a number",
//       });
//     }
//     pipelineIdNum = Number(trimmed);
//   } else {
//     return res.status(400).json({
//       success: false,
//       error: "BAD_REQUEST",
//       message: "pipelineId is required and must be a number",
//     });
//   }

//   if (!Number.isFinite(pipelineIdNum) || !Number.isInteger(pipelineIdNum) || pipelineIdNum <= 0) {
//     return res.status(400).json({
//       success: false,
//       error: "BAD_REQUEST",
//       message: "pipelineId must be a positive integer",
//     });
//   }

//   // ---- INSERT with RETURNING to get regulationId immediately ----
//   const insertSql = `
//     INSERT INTO D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.DIM_REGULATION
//       (REGULATION_NAME, PIPELINE_ID, CREATED_AT)
//     VALUES (?, ?, CURRENT_TIMESTAMP())
//     RETURNING REGULATION_ID, REGULATION_NAME, PIPELINE_ID, CREATED_AT;
//   `;

//   connection.execute({
//     sqlText: insertSql,
//     binds: [regulationName.trim(), pipelineIdNum],
//     complete: (insertErr, insertStmt, rows) => {
//       if (insertErr) {
//         const details = {
//           message: insertErr.message,
//           sqlState: insertErr.sqlState,
//           errorCode: insertErr.code || insertErr.errno,
//           attemptedSql:
//             typeof insertStmt?.getSqlText === "function" ? insertStmt.getSqlText() : insertSql,
//         };

//         console.error("Insert failed:", details);

//         return res.status(500).json({
//           success: false,
//           error: "DATABASE_ERROR",
//           message: "Error inserting regulation",
//           details,
//         });
//       }

//       const inserted = Array.isArray(rows) && rows.length ? rows[0] : null;

//       if (!inserted || !inserted.REGULATION_ID) {
//         return res.status(201).json({
//           success: true,
//           message: "Regulation created successfully (ID not returned)",
//           data: inserted,
//         });
//       }

//       return res.status(201).json({
//         success: true,
//         message: "Regulation created successfully",
//         data: inserted,   // contains REGULATION_ID, REGULATION_NAME, PIPELINE_ID, CREATED_AT
//       });
//     },
//   });
// });
app.post("/api/create-compliances", (req, res) => {
  const {
    regulationName,
    pipelineId, // VARCHAR in your table
    createdBy, // maps to CRETAED_BY (note the table has a typo)
    regulationType, // maps to REGULATIONTYPE
    inputControl, // maps to INPUTCONTROL
  } = req.body || {};

  // Validate required fields
  if (
    !regulationName ||
    typeof regulationName !== "string" ||
    !regulationName.trim()
  ) {
    return res.status(400).json({
      success: false,
      error: "BAD_REQUEST",
      message: "regulationName is required and must be a non-empty string",
    });
  }

  // Optional string validations
  const norm = (v) =>
    v == null ? null : String(v).trim() === "" ? null : String(v).trim();

  const insertSql = `
    INSERT INTO DIM_REGULATION
      (REGULATION_NAME, PIPELINE_ID, CRETAED_BY, REGULATIONTYPE, INPUTCONTROL, CREATED_AT)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP())
  `;

  const binds = [
    regulationName.trim(),
    norm(pipelineId),
    norm(createdBy),
    norm(regulationType),
    norm(inputControl),
  ];

  // 1) INSERT
  connection.execute({
    sqlText: insertSql,
    binds,
    complete: (insertErr /*, insertStmt, _rows */) => {
      if (insertErr) {
        return res.status(500).json({
          success: false,
          error: "DATABASE_ERROR",
          message: "Error inserting regulation",
          details: {
            message: insertErr.message,
            sqlState: insertErr.sqlState,
            errorCode: insertErr.code || insertErr.errno,
          },
        });
      }

      // 2) SELECT back the most recent matching row
      //    (best-effort without REQUEST_ID; safe enough if your combination is unique in practice)
      const selectSql = `
        SELECT REGULATION_ID,
               REGULATION_NAME,
               PIPELINE_ID,
               CRETAED_BY,
               REGULATIONTYPE,
               INPUTCONTROL,
               CREATED_AT
        FROM DIM_REGULATION
        WHERE REGULATION_NAME = ?
          AND (PIPELINE_ID IS NOT DISTINCT FROM ?)
          AND (CRETAED_BY   IS NOT DISTINCT FROM ?)
          AND (REGULATIONTYPE IS NOT DISTINCT FROM ?)
          AND (INPUTCONTROL  IS NOT DISTINCT FROM ?)
        ORDER BY CREATED_AT DESC
        LIMIT 1
      `;

      connection.execute({
        sqlText: selectSql,
        binds,
        complete: (selErr, _selStmt, rows) => {
          if (selErr) {
            return res.status(201).json({
              success: true,
              message:
                "Regulation created successfully (ID not returned due to fetch error)",
              data: null,
              details: {
                message: selErr.message,
                sqlState: selErr.sqlState,
                errorCode: selErr.code || selErr.errno,
              },
            });
          }

          const row = Array.isArray(rows) && rows.length ? rows[0] : null;
          return res.status(201).json({
            success: true,
            message: row
              ? "Regulation created successfully"
              : "Regulation created successfully (ID not returned)",
            data: row,
          });
        },
      });
    },
  });
});

// app.post("/api/policies-from-agent", async (req, res) => {
//   try {
//     const userQuery = req.body?.prompt || req.body?.query;

//     if (!userQuery) {
//       return res.status(400).json({ error: "prompt or query is required" });
//     }

//     const prompt = userQuery;

//     const url = `https://${HOST}/api/v2/databases/${DATABASE}/schemas/${SCHEMA}/agents/${POLICY_AGENT}:run`;

//     const response = await axios.post(
//       url,
//       {
//         agent: `${DATABASE}.${SCHEMA}.${POLICY_AGENT}`,
//         messages: [
//           {
//             role: "user",
//             content: [{ type: "text", text: prompt }]
//           }
//         ],
//         context: {
//           warehouse: WAREHOUSE,
//           database: DATABASE,
//           schema: SCHEMA
//         },
//         options: { allow_execution: true }
//       },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${AUTH_TOKEN}`
//         },
//         httpsAgent: new https.Agent({ rejectUnauthorized: true }),
//         timeout: 60000
//       }
//     );

//     // Extract the final text returned by the agent
//     const agentResponse =
//       response?.data?.messages?.[0]?.content?.[0]?.text ?? "";

//     res.json({
//       success: true,
//       message: "Agent call successful",
//       agent_raw: response.data,
//       agent_text: agentResponse
//     });

//   } catch (err) {
//     console.error("Agent error:", err?.message || err);
//     res.status(500).json({
//       success: false,
//       error: "AGENT_CALL_FAILED",
//       message: err?.message || "Failed to call agent"
//     });
//   }
// });

/* ---------- API: Get Policies for regulation_id = 1 ---------- */

/* ---------- API: Get APPROVED Policies ---------- */
// app.get("/api/policies/approved", (req, res) => {

//   const sql = `
//     SELECT
//       POLICY_ID,
//       POLICY_TEXT,
//       POLICY_TYPE,
//       CITATION_DOC,
//       COMPLIANCE_DATA_REQUIREMENT,
//       APPROVAL_STATUS,
//       REGENERATION_COMMENT
//     FROM DIM_POLICY
//     WHERE REGULATION_ID = 1
//       AND APPROVAL_STATUS = 'approved'
//     ORDER BY POLICY_ID;
//   `;

//   connection.execute({
//     sqlText: sql,
//     complete: (err, stmt, rows) => {
//       if (err) {
//         console.error("❌ Query failed:", err.message);
//         return res.status(500).json({
//           success: false,
//           error: "QUERY_FAILED",
//           message: err.message
//         });
//       }

//       return res.json({
//         success: true,
//         message: "Approved policies fetched successfully",
//         data: rows
//       });
//     }
//   });
// });
// app.get("/api/policies/approved", (req, res) => {
//   const { regulationId } = req.query;

//   const idNum = Number(regulationId);
//   if (!idNum || !Number.isInteger(idNum) || idNum <= 0) {
//     return res.status(400).json({
//       success: false,
//       error: "BAD_REQUEST",
//       message: "A valid 'regulationId' query parameter is required and must be a positive integer."
//     });
//   }

//   const sql = `
//     SELECT
//       POLICY_ID,
//       POLICY_TEXT,
//       POLICY_TYPE,
//       CITATION_DOC,
//       COMPLIANCE_DATA_REQUIREMENT,
//       APPROVAL_STATUS
//     FROM DIM_POLICY
//     WHERE REGULATION_ID = ?
//       AND APPROVAL_STATUS = 'APPROVED'
//     ORDER BY POLICY_ID;
//   `;

//   connection.execute({
//     sqlText: sql,
//     binds: [idNum],
//     complete: (err, stmt, rows) => {
//       if (err) {
//         console.error("❌ Query failed:", err.message);
//         return res.status(500).json({
//           success: false,
//           error: "QUERY_FAILED",
//           message: err.message
//         });
//       }

//       return res.json({
//         success: true,
//         message: "Approved policies fetched successfully",
//         data: rows
//       });
//     }
//   });
// });

// app.post("/api/mapping_agent", async (req, res) => {
//   try {
//     const userQuery = req.body?.prompt || req.body?.query;
//     if (!userQuery) {
//       return res.status(400).json({ error: "prompt or query is required" });
//     }
//     const prompt = userQuery;
//     const url = `https://${HOST}/api/v2/databases/${DATABASE}/schemas/${SCHEMA}/agents/${MAPPING_AGENT}:run`;
//     const response = await axios.post(
//       url,
//       {
//         agent: `${DATABASE}.${SCHEMA}.${POLICY_AGENT}`,
//         messages: [
//           {
//             role: "user",
//             content: [{ type: "text", text: prompt }]
//           }
//         ],
//         context: {
//           warehouse: WAREHOUSE,
//           database: DATABASE,
//           schema: SCHEMA
//         },
//         options: { allow_execution: true }
//       },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${AUTH_TOKEN}`
//         },
//         httpsAgent: new https.Agent({ rejectUnauthorized: true }),
//         timeout: 60000
//       }
//     );
//     // Extract the final text returned by the agent
//     const agentResponse =
//       response?.data?.messages?.[0]?.content?.[0]?.text ?? "";
//     res.json({
//       success: true,
//       message: "Agent call successful",
//       agent_raw: response.data,
//       agent_text: agentResponse
//     });
//   } catch (err) {
//     console.error("Agent error:", err?.message || err);
//     res.status(500).json({
//       success: false,
//       error: "AGENT_CALL_FAILED",
//       message: err?.message || "Failed to call agent"
//     });
//   }
// });

app.post("/api/mapping_agent", async (req, res) => {
  try {
    const userQuery = req.body?.prompt || req.body?.query;
    if (!userQuery) {
      return res.status(400).json({ error: "prompt or query is required" });
    }

    const prompt = String(userQuery);

    // URL already targets the mapping agent
    const url = `https://${HOST}/api/v2/databases/${DATABASE}/schemas/${SCHEMA}/agents/${MAPPING_AGENT}:run`;

    const response = await axios.post(
      url,
      {
        // ✅ FIX: use MAPPING_AGENT here (NOT POLICY_AGENT)
        agent: `${DATABASE}.${SCHEMA}.${MAPPING_AGENT}`,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }],
          },
        ],
        context: {
          warehouse: WAREHOUSE,
          database: DATABASE,
          schema: SCHEMA,
        },
        options: { allow_execution: true },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: true }),
        timeout: 60000,
      },
    );

    // Extract returned text (depends on agent response shape)
    const agentResponse =
      response?.data?.messages?.[0]?.content?.[0]?.text ?? "";

    return res.json({
      success: true,
      message: "Agent call successful",
      agent_raw: response.data,
      agent_text: agentResponse,
    });
  } catch (err) {
    // ✅ Better debugging for 401
    const status = err?.response?.status;
    const upstreamData = err?.response?.data;

    console.error("Agent error:", err?.message || err);
    console.error("Upstream status:", status);
    console.error("Upstream data:", upstreamData);
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });

    return res.status(500).json({
      success: false,
      error: "AGENT_CALL_FAILED",
      message: err?.message || "Failed to call agent",
      upstream_status: status,
      upstream_data: upstreamData,
    });
  }
});
/* ---------- API: Get Policies for regulation_id = 1 ---------- */
// app.get("/api/mapping", (req, res) => {
//   const sql = `
//     SELECT
//       REGULATION_ID,
//   POLICY_ID,
// SEMANTIC_VIEW_NAME,
// TARGET_DATABASE,
// TARGET_SCHEMA,
// TARGET_TABLE,
// TARGET_COLUMN,
// APPROVAL_STATUS,
// APPROVED_BY,
// APPROVED_AT,
// CREATED_AT,
// POLICY_TEXT,
// MATCH_SCORE,
// MATCH_REASON,
// COMPLIANCE_DATA_REQUIREMENT,
// MAPPING_ID,
//     FROM DIM_POLICY_MAPPING
//     WHERE REGULATION_ID = 1
//     ORDER BY POLICY_ID;
//   `;
//   connection.execute({
//     sqlText: sql,
//     complete: (err, stmt, rows) => {
//       if (err) {
//         console.error("❌ Query failed:", err.message);
//         return res.status(500).json({
//           success: false,
//           error: "QUERY_FAILED",
//           message: err.message
//         });
//       }
//       return res.json({
//         success: true,
//         message: "Policies fetched successfully",
//         data: rows
//       });
//     }
//   });
// });
/* ---------- API: Get list of mapped policies and target tables (UI-ready) ---------- */
app.get("/api/mapping", (req, res) => {
  const { regulationId } = req.query;

  const idNum = Number(regulationId);
  if (!idNum || !Number.isInteger(idNum) || idNum <= 0) {
    return res.status(400).json({
      success: false,
      error: "BAD_REQUEST",
      message:
        "A valid 'regulationId' query parameter is required and must be a positive integer.",
    });
  }

  const sql = `
    SELECT
      REGULATION_ID,
      POLICY_ID,
      SEMANTIC_VIEW_NAME,
      TARGET_DATABASE,
      TARGET_SCHEMA,
      TARGET_TABLE,
      TARGET_COLUMN,
      APPROVAL_STATUS,
      APPROVED_BY,
      APPROVED_AT,
      CREATED_AT,
      POLICY_TEXT,
      MATCH_SCORE,
      MATCH_REASON,
      COMPLIANCE_DATA_REQUIREMENT,
      MAPPING_ID
    FROM D_IN_CAPG_POC_AI_SCALABILITY_DEV.SNOW_CAPGE_RAISE_DEV.DIM_POLICY_MAPPING
    WHERE REGULATION_ID = ?
    ORDER BY POLICY_ID;
  `;

  connection.execute({
    sqlText: sql,
    binds: [idNum],
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("❌ Query failed:", err.message);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        return res.status(500).json({
          success: false,
          error: "QUERY_FAILED",
          message: err.message,
        });
      }

      return res.json({
        success: true,
        message: "Mapping fetched successfully",
        data: rows,
      });
    },
  });
});

/* ---------- API: Get Policies for regulation_id = 1 ---------- */
// app.get("/api/generated_sql", (req, res) => {
//   const sql = `
//     SELECT
//       COMPLIANCE_LOGIC_ID,
// POLICY_ID,
// TARGET_TABLE,
// TARGET_COLUMN,
// CC_CODE
//     FROM dim_compliance_check_logic
//   `;
//   connection.execute({
//     sqlText: sql,
//     complete: (err, stmt, rows) => {
//       if (err) {
//         console.error("❌ Query failed:", err.message);
//         return res.status(500).json({
//           success: false,
//           error: "QUERY_FAILED",
//           message: err.message
//         });
//       }
//       return res.json({
//         success: true,
//         message: "Policies fetched successfully",
//         data: rows
//       });
//     }
//   });
// });

// POST /api/compliance/remediation/regenerate
// POST /api/compliance/remediation/regenerate
app.post("/api/compliance/remediation/regenerate", (req, res) => {
  console.log("Body:", req.body);
  // Extract inputs
  const rawPolicyId = req.body?.policyId ?? req.query?.policyId ?? null;
  const rawComment =
    req.body?.userComment ??
    req.body?.comment ??
    req.query?.userComment ??
    req.query?.comment ??
    "";
  const userComment = typeof rawComment === "string" ? rawComment.trim() : "";
  // Validate policyId
  const policyId = rawPolicyId !== null ? Number(rawPolicyId) : null;
  if (!policyId || isNaN(policyId)) {
    return res.status(400).json({
      status: "BAD_REQUEST",
      message: 'policyId is required. Example: { "policyId": 31 }',
    });
  }
  // Validate userComment
  if (!userComment) {
    return res.status(400).json({
      status: "BAD_REQUEST",
      message:
        'userComment is required. Example: { "userComment": "Mask full email..." }',
    });
  }
  // SP call with REAL policyId (NO NULL)
  const query = `
    CALL D_IN_CAPG_POC_AI_SCALABILITY_DEV.SNOW_CAPGE_RAISE_DEV.REGENERATE_REMEDIATION_SQL_USING_LLM(?, ?)
  `;
  connection.execute({
    sqlText: query,
    binds: [
      policyId, // ✔ REAL POLICY_ID
      userComment, // ✔ USER COMMENT
    ],
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("❌ Snowflake error:", err);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        return res.status(500).json({
          status: "ERROR",
          message: err.message,
          code: err.code,
          sqlState: err.sqlState,
          errno: err.errno,
        });
      }
      let spResult = null;
      if (rows && rows.length > 0) {
        const row = rows[0];
        spResult =
          row.REGENERATE_REMEDIATION_SQL_USING_LLM ??
          row.regenerate_remediation_sql_using_llm ??
          Object.values(row)[0];
      }
      // SP logical error (e.g., no row for policy)
      if (spResult?.status && spResult.status !== "SUCCESS") {
        return res.status(422).json({
          status: spResult.status,
          message: spResult.message,
          data: spResult,
        });
      }
      return res.status(200).json({
        status: "SUCCESS",
        message: "Remediation SQL regenerated successfully",
        data: spResult,
      });
    },
  });
});

app.get("/api/generated_sql", (req, res) => {
  const sql = `
    SELECT
      COMPLIANCE_LOGIC_ID,
POLICY_ID,
POLICY_DESCRIPTION,
TARGET_TABLE,
GENERATED_SQL
    FROM D_IN_CAPG_POC_AI_SCALABILITY_DEV.SNOW_CAPGE_RAISE_DEV.dim_compliance_check_logic
  `;
  connection.execute({
    sqlText: sql,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("❌ Query failed:", err.message);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        return res.status(500).json({
          success: false,
          error: "QUERY_FAILED",
          message: err.message,
        });
      }
      return res.json({
        success: true,
        message: "Policies fetched successfully",
        data: rows,
      });
    },
  });
});
// Remediation Script Generation

// app.get("/api/remediation", (req, res) => {
//   const policyId   = req.query.policyId ? Number(req.query.policyId) : null;
//   const logicId    = req.query.logicId ? Number(req.query.logicId) : null;
//   // onlyLatest currently determines we join the latest RESULTS row (always rn=1 below)
//   const onlyLatest = (req.query.onlyLatest ?? "true").toLowerCase() !== "false";
//   const search     = req.query.search ? String(req.query.search) : null;
//   const sortBy     = req.query.sortBy ? String(req.query.sortBy) : "createdAt";
//   const sortDir    = (req.query.sortDir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
//   const limit  = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 500);
//   const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);
//   // IMPORTANT: Map order columns to alias `f` (final SELECT uses `filtered f`)
//   const SORT_MAP = {
//     policyId:     "f.POLICY_ID",
//     logicId:      "f.COMPLIANCE_LOGIC_ID",
//     createdAt:    "f.CREATED_AT",
//     targetTable:  "f.TARGET_TABLE",
//     targetColumn: "f.TARGET_COLUMN",
//   };
//   const orderCol = SORT_MAP[sortBy] || "f.CREATED_AT";
//   const finalSortDir = sortBy === "createdAt" ? (sortDir === "ASC" ? "ASC" : "DESC") : sortDir;
//   const policyFilter = policyId != null ? " AND g.POLICY_ID = ?" : "";
//   const logicFilter  = logicId  != null ? " AND g.COMPLIANCE_LOGIC_ID = ?" : "";
//   const searchFilter = search
//     ? `
//       AND (
//         g.POLICY_DESCRIPTION ILIKE '%' || ? || '%' OR
//         g.TARGET_TABLE       ILIKE '%' || ? || '%' OR
//         g.TARGET_COLUMN      ILIKE '%' || ? || '%' OR
//         g.REMEDIATION_SQL    ILIKE '%' || ? || '%'
//       )
//     `
//     : "";
//   // Latest RESULTS row per COMPLIANCE_LOGIC_ID to enrich approvals
//   const resultsLatestCTE = `
//     results_latest AS (
//       SELECT t.*
//       FROM (
//         SELECT
//           r.*,
//           ROW_NUMBER() OVER (
//             PARTITION BY r.COMPLIANCE_LOGIC_ID
//             ORDER BY r.CREATED_DT DESC
//           ) AS rn
//         FROM D_IN_CAPG_POC_AI_SCALABILITY_DEV.SNOW_CAPGE_RAISE_DEV.DIM_COMPLIANCE_CHECK_LOGIC_RESULTS r
//         -- optionally add: WHERE r.RESULT = FALSE
//       ) t
//       WHERE t.rn = 1
//     )
//   `;
//   const sql = `
//     WITH
//     ${resultsLatestCTE},
//     filtered AS (
//       SELECT
//         g.COMPLIANCE_LOGIC_ID,
//         g.POLICY_ID,
//         g.TARGET_TABLE,
//         g.TARGET_COLUMN,
//         g.POLICY_DESCRIPTION,
//         g.REMEDIATION_SQL,
//         g.REMEDIATION_TYPE,
//         g.REMEDIATION_NOTE,
//         g.SOURCE_RESULT_CREATED,
//         g.CREATED_AT
//       FROM D_IN_CAPG_POC_AI_SCALABILITY_DEV.SNOW_CAPGE_RAISE_DEV.DIM_COMPLIANCE_CHECK_LOGIC_REGENERATE g
//       WHERE 1=1
//       ${policyFilter}
//       ${logicFilter}
//       ${searchFilter}
//     )
//     SELECT
//       f.COMPLIANCE_LOGIC_ID                  AS logicId,
//       f.POLICY_ID                            AS policyId,
//       f.TARGET_TABLE                         AS targetTable,
//       f.TARGET_COLUMN                        AS targetColumn,
//       f.POLICY_DESCRIPTION                   AS policyDescription,
//       f.REMEDIATION_SQL                      AS remediationSql,
//       f.REMEDIATION_TYPE                     AS remediationType,
//       f.REMEDIATION_NOTE                     AS remediationNote,
//       f.SOURCE_RESULT_CREATED                AS sourceResultCreated,
//       f.CREATED_AT                           AS createdAt,
//       COALESCE(r.APPROVAL_STATUS, 'PENDING') AS approvalStatus,
//       r.APPROVED_BY                          AS approvedBy,
//       r.APPROVED_AT                          AS approvedAt,
//       ''                                     AS comments
//     FROM filtered f
//     LEFT JOIN results_latest r
//       ON r.COMPLIANCE_LOGIC_ID = f.COMPLIANCE_LOGIC_ID
//      AND r.POLICY_ID           = f.POLICY_ID
//      AND r.TARGET_TABLE        = f.TARGET_TABLE
//      AND r.TARGET_COLUMN       = f.TARGET_COLUMN
//     ORDER BY ${orderCol} ${finalSortDir}
//     LIMIT ?
//     OFFSET ?`;
//   const binds = [];
//   if (policyId != null) binds.push(policyId);
//   if (logicId  != null) binds.push(logicId);
//   if (search) binds.push(search, search, search, search);
//   binds.push(limit, offset);
//   connection.execute({
//     sqlText: sql,
//     binds,
//     complete: (err, stmt, rows) => {
//       if (err) {
//         console.error("Snowflake error message:", err.message);
//         console.error("Snowflake error code:", err.code);
//         console.error("Snowflake SQL state:", err.sqlState);
//         try { console.error("Executed SQL:", stmt.getSqlText()); } catch (_) {}
//         return res.status(500).json({ error: err.message });
//       }
//       return res.json({ limit, offset, items: rows });
//     },
//   });
// });

app.get("/api/remediation", async (req, res) => {
  const policyId = req.query.policyId ? Number(req.query.policyId) : null;
  const logicId = req.query.logicId ? Number(req.query.logicId) : null;
  const onlyLatest = (req.query.onlyLatest ?? "true").toLowerCase() !== "false";
  const search = req.query.search ? String(req.query.search) : null;
  const sortBy = req.query.sortBy ? String(req.query.sortBy) : "createdAt";
  const sortDir =
    (req.query.sortDir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const limit = Math.min(
    Math.max(parseInt(req.query.limit || "50", 10), 1),
    500,
  );
  const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

  // Sorting mapping (same as your previous API)
  const SORT_MAP = {
    policyId: "f.POLICY_ID",
    logicId: "f.COMPLIANCE_LOGIC_ID",
    createdAt: "f.CREATED_AT",
    targetTable: "f.TARGET_TABLE",
    targetColumn: "f.TARGET_COLUMN",
  };
  const orderCol = SORT_MAP[sortBy] || "f.CREATED_AT";
  const finalSortDir =
    sortBy === "createdAt" ? (sortDir === "ASC" ? "ASC" : "DESC") : sortDir;

  const resultsTable =
    "D_IN_CAPG_POC_AI_SCALABILITY_DEV.SNOW_CAPGE_RAISE_DEV.DIM_COMPLIANCE_CHECK_LOGIC_RESULTS";
  const regenerateTable =
    "D_IN_CAPG_POC_AI_SCALABILITY_DEV.SNOW_CAPGE_RAISE_DEV.DIM_COMPLIANCE_CHECK_LOGIC_REGENERATE";

  // Step 1: Execute stored procedure
  const callSql = `
    CALL D_IN_CAPG_POC_AI_SCALABILITY_DEV.SNOW_CAPGE_RAISE_DEV.GENERATE_REMEDIATION_SQL_1(?, ?)
  `;

  try {
    await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: callSql,
        binds: [resultsTable, regenerateTable],
        complete: (err, stmt, rows) => {
          if (err) {
            console.error("SP Error:", err.message);
            return reject(err);
          }
          console.log("Procedure executed:", rows);
          resolve(rows);
        },
      });
    });
  } catch (err) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    return res.status(500).json({
      error: "Failed to execute stored procedure",
      details: err.message,
    });
  }

  // Step 2: SELECT from regenerated table (same logic as before)
  const policyFilter = policyId != null ? " AND g.POLICY_ID = ?" : "";
  const logicFilter = logicId != null ? " AND g.COMPLIANCE_LOGIC_ID = ?" : "";
  const searchFilter = search
    ? `
      AND (
        g.POLICY_DESCRIPTION ILIKE '%' || ? || '%' OR
        g.TARGET_TABLE       ILIKE '%' || ? || '%' OR
        g.TARGET_COLUMN      ILIKE '%' || ? || '%' OR
        g.REMEDIATION_SQL    ILIKE '%' || ? || '%'
      )
    `
    : "";

  const sql = `
    WITH
    results_latest AS (
      SELECT t.*
      FROM (
        SELECT
          r.*,
          ROW_NUMBER() OVER (
            PARTITION BY r.COMPLIANCE_LOGIC_ID
            ORDER BY r.CREATED_DT DESC
          ) AS rn
        FROM ${resultsTable} r
      ) t
      WHERE t.rn = 1
    ),
    filtered AS (
      SELECT
        g.COMPLIANCE_LOGIC_ID,
        g.POLICY_ID,
        g.TARGET_TABLE,
        g.TARGET_COLUMN,
        g.POLICY_DESCRIPTION,
        g.REMEDIATION_SQL,
        g.REMEDIATION_TYPE,
        g.REMEDIATION_NOTE,
        g.SOURCE_RESULT_CREATED,
        g.CREATED_AT
      FROM ${regenerateTable} g
      WHERE 1=1
      ${policyFilter}
      ${logicFilter}
      ${searchFilter}
    )
    SELECT
      f.COMPLIANCE_LOGIC_ID AS logicId,
      f.POLICY_ID AS policyId,
      f.TARGET_TABLE AS targetTable,
      f.TARGET_COLUMN AS targetColumn,
      f.POLICY_DESCRIPTION AS policyDescription,
      f.REMEDIATION_SQL AS remediationSql,
      f.REMEDIATION_TYPE AS remediationType,
      f.REMEDIATION_NOTE AS remediationNote,
      f.SOURCE_RESULT_CREATED AS sourceResultCreated,
      f.CREATED_AT AS createdAt,
      COALESCE(r.APPROVAL_STATUS, 'PENDING') AS approvalStatus,
      r.APPROVED_BY AS approvedBy,
      r.APPROVED_AT AS approvedAt,
      '' AS comments
    FROM filtered f
    LEFT JOIN results_latest r
      ON r.COMPLIANCE_LOGIC_ID = f.COMPLIANCE_LOGIC_ID
     AND r.POLICY_ID           = f.POLICY_ID
     AND r.TARGET_TABLE        = f.TARGET_TABLE
     AND r.TARGET_COLUMN       = f.TARGET_COLUMN
    ORDER BY ${orderCol} ${finalSortDir}
    LIMIT ?
    OFFSET ?
  `;

  const binds = [];
  if (policyId != null) binds.push(policyId);
  if (logicId != null) binds.push(logicId);
  if (search) binds.push(search, search, search, search);
  binds.push(limit, offset);

  // Execute SELECT
  connection.execute({
    sqlText: sql,
    binds,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("SQL Error:", err.message);
        return res.status(500).json({ error: err.message });
      }
      return res.json({ limit, offset, items: rows });
    },
  });
});

// GET /api/models
app.get("/api/models", (req, res) => {
  const sql = `
    SELECT
      MODEL_NAME
    FROM CORTEX_MODELS
    ORDER BY MODEL_NAME
  `;

  connection.execute({
    sqlText: sql,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("❌ Query failed:", err.message);
        return res.status(500).json({
          success: false,
          error: "QUERY_FAILED",
          message: err.message,
        });
      }

      // Normalize to a simple array for the dropdown if you prefer
      const models = rows.map((r) => r.MODEL_NAME);

      return res.json({
        success: true,
        message: "Models fetched successfully",
        data: models,
      });
    },
  });
});

app.post("/api/run-compliance", (req, res) => {
  const query1 = `CALL run_compliance_sql();`;

  connection.execute({
    sqlText: query1,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("run_compliance_sql failed: " + err.message);
        return res.status(500).send("Error running run_compliance_sql()");
      }

      console.log("run_compliance_sql executed successfully");

      // Now call 2nd procedure
      const query2 = `CALL build_compliance_summary();`;

      connection.execute({
        sqlText: query2,
        complete: (err2, stmt2, rows2) => {
          if (err2) {
            logAuditError({
              eventType: "ERROR",
              errorMessage: err2.message || String(err2),
              context: JSON.stringify({
                endpoint: req.originalUrl,
                method: req.method,
              }),
              logDesc: "Failure in " + req.originalUrl,
              userId: req.headers["x-user-id"] || "unknown",
              querId: err2.statementId || "UNKNOWN",
            });
            console.error("build_compliance_summary failed: " + err2.message);
            return res
              .status(500)
              .send("Error running build_compliance_summary()");
          }

          console.log("build_compliance_summary executed successfully");

          res.send({
            message: "Compliance process completed successfully",
            run_compliance_sql: rows,
            build_compliance_summary: rows2,
          });
        },
      });
    },
  });
});

//   if (!policies || !Array.isArray(policies) || policies.length === 0) {

//     return res.status(400).json({

//       success: false,

//       message: "'policies' must be a non-empty array"

//     });

//   }

//   // Build policy_save instructions for each policy (NO HARDCODING)

//   const calls = policies.map(p => `

// Call policy_save with:

//   REGULATION_ID = ${p.regulation_id}

//   PIPELINE_ID = ${p.pipeline_id}

//   CONTROL_MAPPING = ${JSON.stringify(p.control_mapping)}

//   POLICY_TYPE = ${JSON.stringify(p.policy_type)}

//   POLICY_TEXT = ${JSON.stringify(p.policy_text)}

//   RISK_AREA = ${JSON.stringify(p.risk_area)}

//   CITATION_DOC = ${JSON.stringify(p.citation_doc)}

//   CITATION_CHUNK_REF = ${JSON.stringify(p.citation_chunk_ref)}

//   EFFECTIVE_START_DT = ${JSON.stringify(p.EFFECTIVE_START_DT)}

//   EFFECTIVE_END_DT = ${JSON.stringify(p.EFFECTIVE_END_DT)}

//   REGENERATION_COMMENT = NULL

//   COMPLIANCE_DATA_REQUIREMENT = ${JSON.stringify(p.compliance_data_requirement)}

//   APPROVAL_STATUS = 'APPROVED'

// `).join("\n");

//   const instruction = `

// You are a Policy Scanner Agent.

// APPROVE ONLY — IGNORE ALL SCANNING INSTRUCTIONS.

// Do NOT search. Do NOT extract. Do NOT regenerate.

// Approve the following policy IDs:

// ${JSON.stringify(policies.map(p => p.policy_id))}

// For each policy, execute:

// ${calls}

// `;

//   const payload = {

//     agent: `${DATABASE}.${SCHEMA}.${POLICY_AGENT}`,

//     messages: [

//       {

//         role: "user",

//         content: [{ type: "text", text: instruction }]

//       }

//     ],

//     context: { warehouse: WAREHOUSE, database: DATABASE, schema: SCHEMA },

//     options: { allow_execution: true }

//   };

//   try {

//     const response = await axios.post(

//       `https://${HOST}/api/v2/databases/${DATABASE}/schemas/${SCHEMA}/agents/${POLICY_AGENT}:run`,

//       payload,

//       {

//         headers: {

//           "Content-Type": "application/json",

//           Authorization: `Bearer ${AUTH_TOKEN}`

//         }

//       }

//     );

//     return res.json({

//       success: true,

//       message: "Policies approved successfully",

//       agent_response: response.data

//     });

//   } catch (err) {

//     return res.status(500).json({

//       success: false,

//       error: err?.response?.data || err.message

//     });

//   }

// });

app.post("/api/policies-from-agent", async (req, res) => {
  try {
    const userQuery = req.body?.prompt || req.body?.query;

    if (!userQuery) {
      return res.status(400).json({ error: "prompt or query is required" });
    }

    const prompt = userQuery;

    const url = `https://${HOST}/api/v2/databases/${DATABASE}/schemas/${SCHEMA}/agents/${POLICY_AGENT}:run`;

    const response = await axios.post(
      url,

      {
        agent: `${DATABASE}.${SCHEMA}.${POLICY_AGENT}`,

        messages: [
          {
            role: "user",

            content: [{ type: "text", text: prompt }],
          },
        ],

        context: {
          warehouse: WAREHOUSE,

          database: DATABASE,

          schema: SCHEMA,
        },

        options: { allow_execution: true },
      },

      {
        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${AUTH_TOKEN}`,
        },

        httpsAgent: new https.Agent({ rejectUnauthorized: true }),

        timeout: 60000,
      },
    );

    // Extract the final text returned by the agent

    const agentResponse =
      response?.data?.messages?.[0]?.content?.[0]?.text ?? "";

    res.json({
      success: true,

      message: "Agent call successful",

      agent_raw: response.data,

      agent_text: agentResponse,
    });
  } catch (err) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    console.error("Agent error:", err?.message || err);

    res.status(500).json({
      success: false,

      error: "AGENT_CALL_FAILED",

      message: err?.message || "Failed to call agent",
    });
  }
});

// ✅ APPROVE POLICIES — accepts body: { policies: [ { policy_id: 912, ... } ] }
// PASTE INTO server.js ABOVE app.listen()
// ✅ APPROVE POLICIES API
// POST /api/approvePolicies
// Body: { policies: [ { policy_id: number, ... } ] }
app.post("/api/approvePolicies", (req, res) => {
  try {
    const { policies } = req.body || {};

    // 1) Validate payload
    if (!Array.isArray(policies) || policies.length === 0) {
      return res.status(400).json({
        success: false,
        message: "'policies' must be a non-empty array",
      });
    }

    // 2) Extract policy IDs
    const ids = policies
      .map((p) => Number(p?.policy_id))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid policy_id values found in policies[]",
      });
    }

    // 3) Deduplicate
    const uniqueIds = Array.from(new Set(ids));

    // 4) Build IN (?, ?, ?)
    const placeholders = uniqueIds.map(() => "?").join(",");

    // 5) Update approval status (deterministic)
    const sql = `
      UPDATE DIM_POLICY
      SET APPROVAL_STATUS = 'APPROVED'
      WHERE POLICY_ID IN (${placeholders});
    `;

    connection.execute({
      sqlText: sql,
      binds: uniqueIds,
      complete: (err) => {
        if (err) {
          console.error("❌ ApprovePolicies DB error:", err.message);
          logAuditError({
            eventType: "ERROR",
            errorMessage: err.message || String(err),
            context: JSON.stringify({
              endpoint: req.originalUrl,
              method: req.method,
            }),
            logDesc: "Failure in " + req.originalUrl,
            userId: req.headers["x-user-id"] || "unknown",
            querId: err.statementId || "UNKNOWN",
          });
          return res.status(500).json({
            success: false,
            message: "Failed to approve policies",
            details: err.message,
          });
        }

        return res.json({
          success: true,
          message: "Policies approved successfully",
          approvedPolicyIds: uniqueIds,
        });
      },
    });
  } catch (e) {
    logAuditError({
      eventType: "ERROR",
      errorMessage: e.message || String(e),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: e.statementId || "UNKNOWN",
    });
    console.error("❌ ApprovePolicies exception:", e);
    return res.status(500).json({
      success: false,
      message: "Unexpected error approving policies",
      details: e?.message || String(e),
    });
  }
});

// **
// * GET /api/chat-history
// * Query params:
// *  - chatbot_id: number (required)
// *  - user_id: number (optional; filter to this user's turns)
// *  - limit: number (default 50, max 200)
// *  - offset: number (default 0)
// *  - order: 'asc'|'desc' (default 'asc')
// *  - start_time: string ISO/ 'YYYY-MM-DD HH24:MI:SS' (optional)
// *  - end_time: string ISO/ 'YYYY-MM-DD HH24:MI:SS' (optional)
// */

app.get("/api/policies", (req, res) => {
  const { regulationId } = req.query;

  const idNum = Number(regulationId);
  if (!idNum || !Number.isInteger(idNum) || idNum <= 0) {
    return res.status(400).json({
      success: false,
      error: "BAD_REQUEST",
      message:
        "A valid 'regulationId' query parameter is required and must be a positive integer.",
    });
  }

  const sql = `
    SELECT
      POLICY_ID,
      POLICY_TEXT,
      POLICY_TYPE,
      CITATION_DOC,
      CONTROL_MAPPING AS articleDisplay,
      COMPLIANCE_DATA_REQUIREMENT,
      APPROVAL_STATUS,
      CREATED_AT,
    FROM DIM_POLICY
    WHERE REGULATION_ID = ?
    ORDER BY POLICY_ID;
  `;

  connection.execute({
    sqlText: sql,
    binds: [idNum], // dynamic
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("❌ Query failed:", err.message);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        return res.status(500).json({
          success: false,
          error: "QUERY_FAILED",
          message: err.message,
        });
      }

      return res.json({
        success: true,
        message: "Policies fetched successfully",
        data: rows,
      });
    },
  });
});
app.get("/api/policies/approved", (req, res) => {
  const { regulationId } = req.query;

  const idNum = Number(regulationId);
  if (!idNum || !Number.isInteger(idNum) || idNum <= 0) {
    return res.status(400).json({
      success: false,
      error: "BAD_REQUEST",
      message:
        "A valid 'regulationId' query parameter is required and must be a positive integer.",
    });
  }

  const sql = `
    SELECT
      POLICY_ID,
      POLICY_TEXT,
      POLICY_TYPE,
      CITATION_DOC,
      CONTROL_MAPPING AS articleDisplay,
      COMPLIANCE_DATA_REQUIREMENT,
      APPROVAL_STATUS,
      CREATED_AT
    FROM DIM_POLICY
    WHERE REGULATION_ID = ?
      AND APPROVAL_STATUS = 'APPROVED'
    ORDER BY POLICY_ID;
  `;

  connection.execute({
    sqlText: sql,
    binds: [idNum],
    complete: (err, stmt, rows) => {
      if (err) {
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        console.error("❌ Query failed:", err.message);
        return res.status(500).json({
          success: false,
          error: "QUERY_FAILED",
          message: err.message,
        });
      }

      return res.json({
        success: true,
        message: "Approved policies fetched successfully",
        data: rows,
      });
    },
  });
});

// POST /api/schedules
app.post("/api/schedules", async (req, res) => {
  const {
    regulationId,
    frequency,
    startDate,
    endDate,
    at = "00:05",
    warehouse = process.env.SNOWFLAKE_WAREHOUSE || "SNOW_CAP_SPC",
  } = req.body || {};

  // Validate regulationId
  const regId = Number(regulationId);
  if (!regId || !Number.isInteger(regId) || regId <= 0) {
    return res.status(400).json({
      success: false,
      error: "BAD_REQUEST",
      message:
        "A valid 'regulationId' is required and must be a positive integer.",
    });
  }

  // Validate frequency
  const freq = String(frequency || "").toLowerCase();
  if (!["daily", "weekly", "monthly", "yearly"].includes(freq)) {
    return res.status(400).json({
      success: false,
      error: "BAD_REQUEST",
      message: "Frequency must be one of: daily, weekly, monthly, yearly.",
    });
  }

  try {
    // Set DB & Schema context
    await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: "USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;",
        complete: (e) => (e ? reject(e) : resolve()),
      });
    });
    await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: "USE SCHEMA AI_SCALABILITY_SCHEMA;",
        complete: (e) => (e ? reject(e) : resolve()),
      });
    });

    // Validate & normalize dates
    const iso = (v) => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${v}`);
      return d.toISOString().slice(0, 10);
    };

    const sDate = iso(startDate);
    const eDate = iso(endDate);

    if (sDate > eDate) {
      return res.status(400).json({
        success: false,
        error: "BAD_REQUEST",
        message: "startDate must be <= endDate.",
      });
    }

    // Validate HH:mm time format
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(at);
    if (!match) {
      return res.status(400).json({
        success: false,
        error: "BAD_REQUEST",
        message: "Invalid 'at' time. Use HH:mm (00:00–23:59).",
      });
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    // Compute CRON expression
    const dObj = new Date(`${sDate}T00:00:00Z`);
    const dow = dObj.getUTCDay();
    const dom = Number(sDate.slice(8));
    const mon = Number(sDate.slice(5, 7));

    let cron;
    switch (freq) {
      case "daily":
        cron = `${minute} ${hour} * * *`;
        break;
      case "weekly":
        cron = `${minute} ${hour} * * ${dow}`;
        break;
      case "monthly":
        cron = `${minute} ${hour} ${dom} * *`;
        break;
      case "yearly":
        cron = `${minute} ${hour} ${dom} ${mon} *`;
        break;
    }

    // Ensure HYBRID TABLE exists
    await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: `
          CREATE HYBRID TABLE IF NOT EXISTS D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.JOB_SCHEDULES (
            JOB_ID NUMBER AUTOINCREMENT PRIMARY KEY,
            REGULATION_ID NUMBER NOT NULL,
            START_DATE DATE NOT NULL,
            END_DATE DATE NOT NULL,
            CRON_EXPR STRING NOT NULL,
            CREATED_AT TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
            UPDATED_AT TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
            FREQUENCY STRING NOT NULL DEFAULT 'Daily'
          );
        `,
        complete: (err) => (err ? reject(err) : resolve()),
      });
    });

    // INSERT the schedule
    await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: `
          INSERT INTO D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.JOB_SCHEDULES
            (REGULATION_ID, START_DATE, END_DATE, CRON_EXPR, FREQUENCY)
          VALUES (?, ?, ?, ?, ?);
        `,
        binds: [regId, sDate, eDate, cron, freq],
        complete: (err) => (err ? reject(err) : resolve()),
      });
    });

    // SELECT last inserted JOB_ID
    const selectResult = await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: `
          SELECT JOB_ID
          FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.JOB_SCHEDULES
          WHERE REGULATION_ID = ?
            AND START_DATE = ?
            AND END_DATE = ?
            AND CRON_EXPR = ?
            AND FREQUENCY = ?
          ORDER BY JOB_ID DESC
          LIMIT 1;
        `,
        binds: [regId, sDate, eDate, cron, freq],
        complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows)),
      });
    });

    if (!selectResult.length) {
      throw new Error("Failed to retrieve JOB_ID after insert.");
    }

    const jobId = selectResult[0].JOB_ID;
    const taskName = `D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.JOB_${jobId}_TASK`;

    // CREATE TASK
    await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: `
          CREATE OR REPLACE TASK ${taskName}
            WAREHOUSE = ${warehouse}
            SCHEDULE = 'USING CRON ${cron} Asia/Kolkata'
          AS
            CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.SP_DISPATCH_REGULATION_PY(${jobId});
        `,
        complete: (err) => (err ? reject(err) : resolve()),
      });
    });

    // RESUME TASK
    await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: `ALTER TASK ${taskName} RESUME`,
        complete: (err) => (err ? reject(err) : resolve()),
      });
    });

    return res.json({
      success: true,
      message: "Job scheduled successfully",
      data: {
        jobId,
        regulationId: regId,
        frequency: freq,
        cron,
        startDate: sDate,
        endDate: eDate,
        at,
      },
    });
  } catch (err) {
    console.error("❌ Schedule API Error:", err);
    logAuditError({
      eventType: "ERROR",
      errorMessage: err.message || String(err),
      context: JSON.stringify({
        endpoint: req.originalUrl,
        method: req.method,
      }),
      logDesc: "Failure in " + req.originalUrl,
      userId: req.headers["x-user-id"] || "unknown",
      querId: err.statementId || "UNKNOWN",
    });
    return res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: err.message,
    });
  }
});

// GET /api/jobs/scheduled?regulationId=123
app.get("/api/jobs/scheduled", (req, res) => {
  const { regulationId } = req.query;

  // Validate regulationId
  const idNum = Number(regulationId);
  if (!idNum || !Number.isInteger(idNum) || idNum <= 0) {
    return res.status(400).json({
      success: false,
      error: "BAD_REQUEST",
      message:
        "A valid 'regulationId' query parameter is required and must be a positive integer.",
    });
  }

  const sql = `
    SELECT
      JOB_ID,
      REGULATION_ID,
      START_DATE,
      END_DATE,
      FREQUENCY,
      CRON_EXPR,
      CREATED_AT,
      UPDATED_AT
    FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.JOB_SCHEDULES
    WHERE REGULATION_ID = ?
    ORDER BY JOB_ID;
  `;

  connection.execute({
    sqlText: sql,
    binds: [idNum],
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("❌ Query failed:", err.message);
        logAuditError({
          eventType: "ERROR",
          errorMessage: err.message || String(err),
          context: JSON.stringify({
            endpoint: req.originalUrl,
            method: req.method,
          }),
          logDesc: "Failure in " + req.originalUrl,
          userId: req.headers["x-user-id"] || "unknown",
          querId: err.statementId || "UNKNOWN",
        });
        return res.status(500).json({
          success: false,
          error: "QUERY_FAILED",
          message: err.message,
        });
      }

      return res.json({
        success: true,
        message: "Scheduled jobs fetched successfully",
        data: rows,
      });
    },
  });
});

const PIPELINE_METADATA_FQN = `${process.env.SNOWFLAKE_DATABASE || "D_IN_CAPG_POC_AI_SCALABILITY"}.${process.env.SNOWFLAKE_SCHEMA || "AI_SCALABILITY_SCHEMA"}.R_PIPELINE_METADATA_TBL`;

app.get("/api/check-pipeline-name", async (req, res) => {
  try {
    const { pipelineName, pipelineId } = req.query;

    if (!pipelineName || !String(pipelineName).trim()) {
      return res.status(400).json({
        success: false,
        error: "pipelineName is required",
      });
    }

    const normalizedName = String(pipelineName).trim();

    let sql = `
      SELECT COUNT(*) AS count
      FROM R_PIPELINE_METADATA_TBL
      WHERE LOWER(TRIM(pipeline_name)) = LOWER(TRIM(?))
    `;

    const binds = [normalizedName];

    // edit mode: ignore same current row
    if (
      pipelineId !== undefined &&
      pipelineId !== null &&
      String(pipelineId).trim() !== ""
    ) {
      sql += ` AND pipeline_id <> ?`;
      binds.push(Number(pipelineId));
    }

    const rows = await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: sql,
        binds,
        complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows)),
      });
    });

    const count = rows?.[0]?.COUNT ?? rows?.[0]?.count ?? 0;
    const exists = Number(count) > 0;

    console.log("[check-pipeline-name]", {
      pipelineName: normalizedName,
      pipelineId: pipelineId ?? null,
      count,
      exists,
    });

    return res.json({
      success: true,
      exists,
      message: exists
        ? "Pipeline name already exists"
        : "Pipeline name is available",
    });
  } catch (err) {
    console.error("Error checking pipeline name:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to validate pipeline name",
      message: err?.message || String(err),
    });
  }
});

app.post(
  "/pipelines/upload-document",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file provided." });
      }

      const originalName = req.file.originalname;
      if (!/\.(pdf|docx?|txt)$/i.test(originalName)) {
        // Remove the temp file multer created
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: "Unsupported file type. Supported: PDF, DOC, DOCX, TXT.",
        });
      }

      const db =
        req.body.db ||
        process.env.SEMANTIC_DB ||
        "D_IN_CAPG_POC_AI_SCALABILITY";
      const schema =
        req.body.schema ||
        process.env.SEMANTIC_SCHEMA ||
        "AI_SCALABILITY_SCHEMA";
      const stage =
        req.body.stage || process.env.SEMANTIC_STAGE || "RAG_PIPELINE_STAGE";

      // Ensure tmp dir exists
      if (!fs.existsSync(uploadTmpDir))
        fs.mkdirSync(uploadTmpDir, { recursive: true });

      // Multer saves with a random name; rename to the original filename
      const destPath = path.join(uploadTmpDir, originalName);
      fs.renameSync(req.file.path, destPath);

      // Extract text content for non-PDF types before upload
      const ext = path.extname(originalName).toLowerCase();
      let extractedText = null;
      if (ext === ".txt") {
        extractedText = fs.readFileSync(destPath, "utf-8");
      } else if (ext === ".doc" || ext === ".docx") {
        const result = await mammoth.extractRawText({ path: destPath });
        extractedText = result.value;
      }

      // Set Snowflake context before stage operation
      await execQuery(`USE WAREHOUSE ${quoteIdent(WAREHOUSE)}`);
      await execQuery(`USE DATABASE ${quoteIdent(db)}`);
      await execQuery(`USE SCHEMA ${quoteIdent(schema)}`);

      // Upload to Snowflake stage
      const fileUri = `file://${destPath.replace(/\\/g, "/")}`;
      const putSql = `PUT '${fileUri}' @${stage} AUTO_COMPRESS=FALSE OVERWRITE=TRUE`;
      await execQuery(putSql);

      // Clean up temp file
      try {
        fs.unlinkSync(destPath);
      } catch (_) {
        /* ignore */
      }

      // Parse document and insert extracted text into RAW_TEXT_FINAL
      const stageRef = `@${quoteIdent(db)}.${quoteIdent(schema)}.${quoteIdent(stage)}`;
      const rawTextTable = process.env.RAW_TEXT_TABLE ?? "RAW_TEXT_FINAL";
      const fileSize = req.file.size || 0;

      // Remove existing row for this file (in case of re-upload)
      await execWithBinds(
        `DELETE FROM ${quoteIdent(db)}.${quoteIdent(schema)}.${quoteIdent(rawTextTable)} WHERE RELATIVE_PATH = ?`,
        [originalName],
      );

      // Insert into RAW_TEXT_FINAL: use PARSE_DOCUMENT for PDFs, pre-extracted text for others
      if (ext === ".pdf") {
        const insertSql = `
        INSERT INTO ${quoteIdent(db)}.${quoteIdent(schema)}.${quoteIdent(rawTextTable)}
          (RELATIVE_PATH, SIZE, FILE_URL, SCOPED_FILE_URL, EXTRACTED_LAYOUT)
        SELECT
          ?,
          ?,
          BUILD_STAGE_FILE_URL(${stageRef}, ?),
          BUILD_SCOPED_FILE_URL(${stageRef}, ?),
          SNOWFLAKE.CORTEX.PARSE_DOCUMENT(${stageRef}, ?, {'mode': 'LAYOUT'}):content::VARCHAR
      `;
        await execWithBinds(insertSql, [
          originalName,
          fileSize,
          originalName,
          originalName,
          originalName,
        ]);
      } else {
        // For .doc, .docx, .txt — use pre-extracted text
        const insertSql = `
        INSERT INTO ${quoteIdent(db)}.${quoteIdent(schema)}.${quoteIdent(rawTextTable)}
          (RELATIVE_PATH, SIZE, FILE_URL, SCOPED_FILE_URL, EXTRACTED_LAYOUT)
        SELECT
          ?,
          ?,
          BUILD_STAGE_FILE_URL(${stageRef}, ?),
          BUILD_SCOPED_FILE_URL(${stageRef}, ?),
          ?
      `;
        await execWithBinds(insertSql, [
          originalName,
          fileSize,
          originalName,
          originalName,
          extractedText || "",
        ]);
      }

      return res.json({
        success: true,
        uploaded: true,
        file_name: originalName,
        stage_path: `@${stage}/${originalName}`,
      });
    } catch (err) {
      // Clean up temp file on error
      try {
        if (req.file) fs.unlinkSync(req.file.path);
      } catch (_) {
        /* ignore */
      }
      console.error("Upload document error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to upload document.",
        details: err?.message || String(err),
      });
    }
  },
);

app.post(
  "/api/upload-chat-document",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file provided." });
      }

      const originalName = req.file.originalname;
      const ext = path.extname(originalName).toLowerCase();
      const SUPPORTED_EXTENSIONS = new Set([
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
        ".tiff",
        ".bmp",
        ".docx",
        ".txt",
      ]);

      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: `Unsupported file type. Supported: PDF, PNG, JPG, JPEG, TIFF, BMP, DOCX, TXT.`,
        });
      }

      // Determine file_type for downstream processing
      const IMAGE_EXTENSIONS = new Set([
        ".png",
        ".jpg",
        ".jpeg",
        ".tiff",
        ".bmp",
      ]);
      const DOC_EXTENSIONS = new Set([".docx", ".txt"]);
      const file_type = IMAGE_EXTENSIONS.has(ext)
        ? "image"
        : DOC_EXTENSIONS.has(ext)
          ? "document"
          : "pdf";

      const db =
        req.body.db ||
        process.env.SEMANTIC_DB ||
        "D_IN_CAPG_POC_AI_SCALABILITY";
      const schema =
        req.body.schema ||
        process.env.SEMANTIC_SCHEMA ||
        "AI_SCALABILITY_SCHEMA";
      const stage = req.body.stage || "UPLOAD_STAGE";

      // Ensure tmp dir exists
      if (!fs.existsSync(uploadTmpDir))
        fs.mkdirSync(uploadTmpDir, { recursive: true });

      // Rename to original filename
      const destPath = path.join(uploadTmpDir, originalName);
      fs.renameSync(req.file.path, destPath);

      // Extract text content for document types (PARSE_DOCUMENT doesn't support .docx/.txt)
      let text_content = null;
      if (ext === ".txt") {
        text_content = fs.readFileSync(destPath, "utf-8");
      } else if (ext === ".docx") {
        const result = await mammoth.extractRawText({ path: destPath });
        text_content = result.value;
      }

      // Set Snowflake context
      await execQuery(`USE WAREHOUSE ${quoteIdent(WAREHOUSE)}`);
      await execQuery(`USE DATABASE ${quoteIdent(db)}`);
      await execQuery(`USE SCHEMA ${quoteIdent(schema)}`);

      // Upload to Snowflake stage
      const fileUri = `file://${destPath.replace(/\\/g, "/")}`;
      const putSql = `PUT '${fileUri}' @${stage} AUTO_COMPRESS=FALSE OVERWRITE=TRUE`;
      await execQuery(putSql);

      // Clean up temp file
      try {
        fs.unlinkSync(destPath);
      } catch (_) {
        /* ignore */
      }

      const response = {
        success: true,
        file_name: originalName,
        file_type,
        stage_path: `@${stage}/${originalName}`,
      };
      if (text_content !== null) {
        response.text_content = text_content;
      }
      return res.json(response);
    } catch (err) {
      try {
        if (req.file) fs.unlinkSync(req.file.path);
      } catch (_) {
        /* ignore */
      }
      console.error("Upload chat document error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to upload chat document.",
        details: err?.message || String(err),
      });
    }
  },
);

app.post("/api/process-uploaded-chat-multi-model", async (req, res) => {
  try {
    const {
      file_name,
      file_type,
      user_instruction,
      user_name,
      models,
      text_content,
    } = req.body;

    // First, try the stored procedure (skip for document types that SP doesn't support)
    let data = null;
    if (file_type !== "document") {
      const sqlText = `CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.PROCESS_UPLOADED_CHAT_MULTI_MODEL(?, ?, ?, ?, ?)`;
      try {
        const rows = await new Promise((resolve, reject) => {
          connection.execute({
            sqlText,
            binds: [file_name, file_type, user_instruction, user_name, models],
            complete: (err, stmt, rows) => (err ? reject(err) : resolve(rows)),
          });
        });
        const raw = rows[0] ? Object.values(rows[0])[0] : null;
        data = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (spErr) {
        console.error(
          "[MULTI-MODEL] SP call failed, falling back to direct CORTEX.COMPLETE:",
          spErr.message,
        );
      }
    }

    // Check if SP returned valid responses
    const hasResponses =
      data &&
      data.responses &&
      typeof data.responses === "object" &&
      Object.keys(data.responses).length > 0;

    if (!hasResponses) {
      console.log(
        "[MULTI-MODEL] SP returned empty responses, using direct CORTEX.COMPLETE fallback",
      );

      // Parse models CSV into array
      const modelList = models
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      // Extract document content
      let docContent = "";
      if (file_type === "document" && text_content) {
        // For .docx/.txt files, text was already extracted during upload
        docContent = text_content;
      } else {
        // Use PARSE_DOCUMENT for PDF/image files
        const parseMode = file_type === "image" ? "OCR" : "LAYOUT";
        const parseDocSql = `
          SELECT SNOWFLAKE.CORTEX.PARSE_DOCUMENT(
            @D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.UPLOAD_STAGE,
            '${file_name.replace(/'/g, "''")}',
            {'mode': '${parseMode}'}
          ):content::VARCHAR AS doc_content
        `;
        const parseResult = await executeQuery(parseDocSql);
        docContent = parseResult[0]?.DOC_CONTENT || "";
      }

      if (!docContent) {
        return res.status(200).json({
          success: true,
          data: {
            file_name,
            instruction: user_instruction,
            models_used: models,
            responses: {},
            error: "Could not extract content from the uploaded document.",
          },
        });
      }

      // Build prompt with document context and user instruction
      const sourceDesc =
        file_type === "image" ? "an image (OCR-extracted text)" : "a document";
      const fullPrompt = `You are an AI assistant. The user has uploaded ${sourceDesc} and wants you to help with it.\n\n<document>\n${docContent}\n</document>\n\n<instruction>\n${user_instruction}\n</instruction>\n\nPlease respond to the user's instruction based on the document content above.`;

      // Call CORTEX.COMPLETE for each model
      const responses = {};
      for (const model of modelList) {
        try {
          const cortexQuery = `SELECT SNOWFLAKE.CORTEX.COMPLETE('${model.replace(/'/g, "''")}', '${fullPrompt.replace(/'/g, "''")}') AS response`;
          const result = await executeQuery(cortexQuery);
          responses[model] =
            result[0]?.RESPONSE ||
            result[0][Object.keys(result[0])[0]] ||
            "No response.";
        } catch (modelErr) {
          console.error(
            `[MULTI-MODEL] Error calling CORTEX.COMPLETE for model ${model}:`,
            modelErr.message,
          );
          responses[model] = `Error: Could not get response from ${model}.`;
        }
      }

      data = {
        file_name,
        instruction: user_instruction,
        models_used: models,
        responses,
      };
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("[MULTI-MODEL] Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/process-uploaded-data-analysis", async (req, res) => {
  try {
    const { file_name, file_type, user_instruction, user_name } = req.body;

    if (!file_name || !user_instruction) {
      return res
        .status(400)
        .json({ error: "file_name and user_instruction are required" });
    }

    if (!HOST || !DATABASE || !SCHEMA || !AGENT_STRUCTURED) {
      return res
        .status(500)
        .json({ error: "Missing HOST/DATABASE/SCHEMA/AGENT_STRUCTURED" });
    }

    // Step 1: Extract document content from UPLOAD_STAGE using PARSE_DOCUMENT
    // Use OCR mode for image files (handwritten/scanned), LAYOUT for PDFs
    const parseMode = file_type === "image" ? "OCR" : "LAYOUT";
    const parseDocSql = `
      SELECT SNOWFLAKE.CORTEX.PARSE_DOCUMENT(
        @D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.UPLOAD_STAGE,
        '${file_name.replace(/'/g, "''")}',
        {'mode': '${parseMode}'}
      ):content::VARCHAR AS doc_content
    `;
    const parseResult = await executeQuery(parseDocSql);
    const docContent = parseResult[0]?.DOC_CONTENT || "";

    if (!docContent) {
      return res.status(200).json({
        agent: AGENT_STRUCTURED,
        planningText: "",
        keyInsights: [],
        sql: "",
        rows: [],
        chartSpec: null,
        queryId: null,
        queryIdVerified: false,
        error: "Could not extract content from the uploaded document.",
      });
    }

    // Step 2: Build prompt that combines document content with user instruction
    const sourceDesc =
      file_type === "image"
        ? "an image (OCR-extracted text)"
        : `a document (${file_name})`;
    const prompt = `**Follow these rules:**\n\n1. Output must be valid **React Markdown**.\n2. Use proper **bold**, **indentation**, and formatting.\n\n---\n\n**User Prompt:**\nThe user has uploaded ${sourceDesc}. Based on the document content below, answer the following question.\n\n**User Question:** ${user_instruction}\n\n**Uploaded Document Content:**\n${docContent.slice(0, 30000)}`;

    // Step 3: Call STRUCTURED_DATA_AGENT via Cortex Agent API (same as /api/structured-agent)
    const url = `https://${HOST}/api/v2/databases/${DATABASE}/schemas/${SCHEMA}/agents/${AGENT_STRUCTURED}:run`;
    const authHeaders = await getCortexAuthHeaders();
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...authHeaders,
    };
    const body = {
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      tool_choice: { type: "auto" },
    };

    const upstream = await axios.post(url, body, {
      headers,
      responseType: "stream",
      timeout: 120000,
      validateStatus: (s) => s < 500,
    });

    if (upstream.status >= 400) {
      let txt = "";
      for await (const chunk of upstream.data) txt += chunk.toString("utf-8");
      return res.status(upstream.status).json({
        error: `Upstream ${upstream.status}`,
        details: tryJson(txt) ?? txt,
      });
    }

    const ctype = String(
      upstream.headers?.["content-type"] || "",
    ).toLowerCase();
    const acc = { answerText: "", sqlCandidates: [] };

    if (!ctype.includes("text/event-stream")) {
      let fallback = "";
      for await (const chunk of upstream.data)
        fallback += chunk.toString("utf-8");
      const parsed = tryJson(fallback);
      const { answerText, sql } = extractFromNonStreamingResponse(parsed);
      acc.answerText = answerText || "";
      if (sql) acc.sqlCandidates.push(sql);
    } else {
      let buf = "";
      let currentEvent = null;
      let dataBuf = "";
      const flush = () => {
        if (!dataBuf) return;
        const payload = tryJson(dataBuf.trim());
        if (payload) processSseEvent(currentEvent, payload, acc);
        dataBuf = "";
      };
      await new Promise((resolve, reject) => {
        upstream.data.on("data", (chunk) => {
          buf += chunk.toString("utf-8");
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            let line = buf.slice(0, nl).replace(/\r$/, "");
            buf = buf.slice(nl + 1);
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
              continue;
            }
            if (line.startsWith("data:")) {
              dataBuf += line.slice(5).trimStart();
              continue;
            }
            if (line.trim() === "") {
              flush();
              currentEvent = null;
            }
          }
        });
        upstream.data.on("end", () => {
          flush();
          resolve();
        });
        upstream.data.on("error", reject);
      });
    }

    // SQL block inside answer text
    const fenced = extractSqlFromAnswerText(acc.answerText);
    if (fenced) acc.sqlCandidates.push(fenced);

    // SQL Extraction
    const normalizedCandidates = normalizeAndSplitStatements(acc.sqlCandidates);
    for (const c of normalizedCandidates) {
      c.clean = c.clean
        .replace(
          /D_IN_CAPG_POC_AI_SCALABILITY\.AI_SCALABILITY_SCHEMA/gi,
          "D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA",
        )
        .replace(/D_IN_CAPG_POC_AI_SCALABILITY/gi, "D_IN_CAPG_POC_AI_SCALABILITY")
        .replace(/AI_SCALABILITY_SCHEMA/gi, "AI_SCALABILITY_SCHEMA");
    }

    let rows = [];
    let finalSql = "";
    let executionError = null;
    let verifiedQueryId = null;

    if (normalizedCandidates.length) {
      for (let i = normalizedCandidates.length - 1; i >= 0; i--) {
        const candidate = normalizedCandidates[i];
        if (!candidate.clean || looksIncomplete(candidate.clean)) continue;
        try {
          const { rows: r, stmt } = await new Promise((resolve, reject) => {
            connection.execute({
              sqlText: candidate.clean,
              complete: (err, stmt, resRows) => {
                if (err) return reject(err);
                resolve({ rows: Array.isArray(resRows) ? resRows : [], stmt });
              },
            });
          });
          finalSql = candidate.clean;
          rows = r;
          verifiedQueryId = stmt?.getStatementId?.() || null;
          if (rows.length > 0) break;
        } catch (err) {
          executionError = err?.message || String(err);
        }
      }
    }

    // Chart
    let chartSpec = null;
    if (Array.isArray(rows) && rows.length) {
      chartSpec = buildAutoChartSpec(rows);
    }

    // Clean + split + extract insights
    const cleanedText = cleanAgentText(acc.answerText);
    let { planningText, finalAnswerText } = splitPlanningAndFinal(cleanedText);
    planningText = removeQueryId(planningText);
    finalAnswerText = removeQueryId(finalAnswerText);

    let insightsSource = finalAnswerText || cleanedText;
    let { keyInsights } = extractKeyInsights(insightsSource);

    if ((!finalAnswerText || !keyInsights.length) && planningText) {
      const tmp = extractKeyInsights(planningText);
      if (tmp.keyInsights.length && !keyInsights.length) {
        keyInsights = tmp.keyInsights;
      }
    }

    if (
      (!keyInsights || !keyInsights.length) &&
      Array.isArray(rows) &&
      rows.length
    ) {
      keyInsights = generateInsightsFromRows(rows);
    }

    const unverifiedAgentQueryId = extractQueryIdFromText(acc.answerText) || "";

    return res.json({
      agent: AGENT_STRUCTURED,
      planningText: planningText || "",
      answerText: finalAnswerText || cleanedText || "",
      keyInsights,
      sql: finalSql || "",
      rows,
      chartSpec,
      queryId: verifiedQueryId || unverifiedAgentQueryId || null,
      queryIdVerified: Boolean(verifiedQueryId),
      error: executionError || undefined,
    });
  } catch (err) {
    console.error("[UPLOADED-DATA-ANALYSIS] Error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// Email Automation
//GET Email Automation Settings (UI Load)
//UPDATE Email Automation Settings (UI Save)
//TEST Email (UI “Send Test” Button)

// GET Email Automation Settings (UI Load)
app.get("/api/email-automation/settings", async (req, res) => {
  try {
    const rows = await runQuery(`
      SELECT *
      FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.EMAIL_ALERT_SETTINGS_TBL
    `);

    const summary = rows.find((r) => r.EMAIL_TYPE === "SUMMARY") || {};
    const error = rows.find((r) => r.EMAIL_TYPE === "ERROR") || {};

    res.json({
      summary: {
        enabled: summary.ENABLED ?? false,
        frequency: summary.FREQUENCY ?? "daily",
        hour: summary.HOUR ?? "09",
        minute: summary.MINUTE ?? "00",
        ampm: summary.AMPM ?? "AM",
        recipients: summary.RECIPIENT_EMAILS ?? [],
      },
      error: {
        enabled: error.ENABLED ?? false,
        recipients: error.RECIPIENT_EMAILS ?? [],
      },
    });
  } catch (err) {
    console.error("Load email settings error:", err);
    res.status(500).json({ error: "Failed to load email automation settings" });
  }
});

// UPDATE Email Automation Settings (UI Save) — supports both PUT and POST
const updateEmailSettings = async (req, res) => {
  try {
    const { summary, error } = req.body;

    if (!summary || !error) {
      return res.status(400).json({ error: "Missing summary or error config" });
    }

    const sanitize = (val) => String(val).replace(/'/g, "''");

    const normRecipients = (r) => {
      const arr = Array.isArray(r) ? r : String(r).split(",");
      return arr.map((e) => `'${sanitize(e.trim())}'`).join(",");
    };

    const summaryEmails = normRecipients(summary.recipients || "");
    const errorEmails = normRecipients(error.recipients || "");
    const toBool = (val) => (val ? "TRUE" : "FALSE");

    await runQuery(`
      MERGE INTO D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.EMAIL_ALERT_SETTINGS_TBL t
      USING (SELECT 'SUMMARY' AS EMAIL_TYPE) s
      ON t.EMAIL_TYPE = s.EMAIL_TYPE
      WHEN MATCHED THEN UPDATE SET
        ENABLED = ${toBool(summary.enabled)},
        FREQUENCY = '${sanitize(summary.frequency)}',
        HOUR = '${sanitize(summary.hour)}',
        MINUTE = '${sanitize(summary.minute)}',
        AMPM = '${sanitize(summary.ampm)}',
        RECIPIENT_EMAILS = ARRAY_CONSTRUCT(${summaryEmails})
      WHEN NOT MATCHED THEN INSERT VALUES (
        'SUMMARY',
        ${toBool(summary.enabled)},
        '${sanitize(summary.frequency)}',
        '${sanitize(summary.hour)}',
        '${sanitize(summary.minute)}',
        '${sanitize(summary.ampm)}',
        ARRAY_CONSTRUCT(${summaryEmails})
      );
    `);

    await runQuery(`
      MERGE INTO D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.EMAIL_ALERT_SETTINGS_TBL t
      USING (SELECT 'ERROR' AS EMAIL_TYPE) s
      ON t.EMAIL_TYPE = s.EMAIL_TYPE
      WHEN MATCHED THEN UPDATE SET
        ENABLED = ${toBool(error.enabled)},
        RECIPIENT_EMAILS = ARRAY_CONSTRUCT(${errorEmails})
      WHEN NOT MATCHED THEN INSERT VALUES (
        'ERROR',
        ${toBool(error.enabled)},
        NULL, NULL, NULL, NULL,
        ARRAY_CONSTRUCT(${errorEmails})
      );
    `);

    let hour24 = Number(summary.hour);
    if (summary.ampm === "PM" && hour24 !== 12) hour24 += 12;
    if (summary.ampm === "AM" && hour24 === 12) hour24 = 0;

    const cron = `${summary.minute} ${hour24} * * *`;

    await runQuery(
      `ALTER TASK D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.DAILY_SUMMARY_TASK SUSPEND`,
    );
    await runQuery(
      `ALTER TASK D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.DAILY_SUMMARY_TASK SET SCHEDULE = 'USING CRON ${cron} Asia/Kolkata'`,
    );
    await runQuery(
      `ALTER TASK D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.DAILY_SUMMARY_TASK RESUME`,
    );

    res.json({ message: "Email automation settings updated successfully" });
  } catch (err) {
    console.error("Update email automation error:", err.message || err);
    res
      .status(500)
      .json({ error: "Failed to update email automation settings" });
  }
};

app.put("/api/email-automation/settings", updateEmailSettings);
app.post("/api/email-automation/update", updateEmailSettings);

// TEST Email (UI "Send Test" Button) — calls SPs directly, no hardcoded HTML
app.post("/api/email-automation/test", async (req, res) => {
  try {
    const { type = "" } = req.body || {};
    const testType = type.toString().toLowerCase();

    const rows = await runQuery(`
      SELECT EMAIL_TYPE, ENABLED, RECIPIENT_EMAILS
      FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.EMAIL_ALERT_SETTINGS_TBL
    `);

    const summaryEnabled = rows.find(
      (r) => r.EMAIL_TYPE === "SUMMARY",
    )?.ENABLED;
    const errorRow = rows.find((r) => r.EMAIL_TYPE === "ERROR") || {};
    const errorEnabled = errorRow.ENABLED;
    const errorRecipients = Array.isArray(errorRow.RECIPIENT_EMAILS)
      ? errorRow.RECIPIENT_EMAILS.filter(Boolean)
      : [];

    const result = {};

    if ((testType === "summary" || testType === "") && summaryEnabled) {
      const spResult = await runQuery(`
        CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.SP_DAILY_SUMMARY_EMAIL()
      `);
      result.summary =
        spResult?.[0]?.SP_DAILY_SUMMARY_EMAIL || "Summary email triggered";
    }

    if ((testType === "error" || testType === "") && errorEnabled) {
      if (errorRecipients.length === 0) {
        throw new Error("No error email recipients configured.");
      }

      const spResult = await runQuery(`
        CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.SP_AUTO_ERROR_EMAIL()
      `);
      result.error =
        spResult?.[0]?.SP_AUTO_ERROR_EMAIL || "Error alert triggered";
    }

    res.json(result);
  } catch (err) {
    console.error("Test email error:", err);
    res.status(500).json({ error: err.message || "Failed to send test email" });
  }
});

app.get("/api/email-automation/users", async (req, res) => {
  try {
    const rows = await runQuery(`
      SELECT EMAIL
      FROM D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.TEAM_RECIPIENTS_TBL
      WHERE ACTIVE = TRUE
      ORDER BY EMAIL
    `);
    res.json(rows.map((r) => r.EMAIL));
  } catch (err) {
    console.error("Search users error:", err);
    res.status(500).json({ error: "Failed to search users" });
  }
});

app.post("/api/email-automation/add-user", async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const sanitize = (val) => String(val).replace(/'/g, "''");
    const result = await runQuery(`
      CALL D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.SP_ADD_TEAM_RECIPIENT(
        '${sanitize(email.trim())}',
        '${sanitize(name?.trim() || "")}'
      )
    `);
    console.log("SP result:", JSON.stringify(result));
    const msg = result?.[0]?.SP_ADD_TEAM_RECIPIENT || JSON.stringify(result);
    if (msg.startsWith("FAILED")) {
      return res.status(400).json({ error: msg });
    }
    res.json({ message: msg });
  } catch (err) {
    console.error("Add user error:", err.message || err);
    res.status(500).json({ error: err.message || "Failed to add user" });
  }
});

app.post("/api/email-automation/remove-user", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const sanitize = (val) => String(val).replace(/'/g, "''");
    await runQuery(`
      UPDATE D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.TEAM_RECIPIENTS_TBL
      SET ACTIVE = FALSE
      WHERE LOWER(EMAIL) = '${sanitize(email.trim().toLowerCase())}'
    `);
    res.json({ message: "User removed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove user" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
