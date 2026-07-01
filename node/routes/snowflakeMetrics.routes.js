import express from "express";
import {
  getWarehouses,
  getDatabases,
  getWarehouseCreditUsage,
  getDailyMetering,
  getCortexAICredits,
  getCortexAgentCredits,
  getQueryPerformance,
  getQueryTrend,
  getDatabaseStorage,
  getTableStorage,
  getWarehouseLoad,
  getWarehouseEvents,
  getWarehouseStatus,
  getQueryTypeBreakdown,
  getUserActivity,
  getCostliestQueries,
  getQueryRecommendations,
} from "../controllers/snowflakeMetrics.controller.js";

const router = express.Router();

// Lookups (for filter dropdowns)
router.get("/warehouses", getWarehouses);
router.get("/databases", getDatabases);

// 1. Credit & Cost
router.get("/warehouse-credit-usage", getWarehouseCreditUsage);
router.get("/daily-metering", getDailyMetering);
router.get("/cortex-ai-credits", getCortexAICredits);
router.get("/cortex-agent-credits", getCortexAgentCredits);

// 2. Query Performance
router.get("/query-performance", getQueryPerformance);
router.get("/query-trend", getQueryTrend);
router.get("/costliest-queries", getCostliestQueries);

// 3. Storage
router.get("/database-storage", getDatabaseStorage);
router.get("/table-storage", getTableStorage);

// 4. Warehouse Load & Status
router.get("/warehouse-load", getWarehouseLoad);
router.get("/warehouse-events", getWarehouseEvents);
router.get("/warehouse-status", getWarehouseStatus);

// 6. Database-Specific Metrics
router.get("/query-type-breakdown", getQueryTypeBreakdown);
router.get("/user-activity", getUserActivity);

// 7. Query Optimization Recommendations
router.post("/query-recommendations", getQueryRecommendations);

export default router;
