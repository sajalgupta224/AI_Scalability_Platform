import express from "express";
import {
  getRoles,
  getCurrentUser,
  getContainerServicesHistory,
} from "../controllers/snowflake.controller.js";

const router = express.Router();

// GET /snowflake/roles - Get Snowflake roles
router.get("/roles", getRoles);

// GET /snowflake/current-user - Get Snowflake currnet user
router.get("/current-user", getCurrentUser);

// GET /snowflake/container-services/history - Get container services history with filters
router.get("/container-services/history", getContainerServicesHistory);

export default router;
