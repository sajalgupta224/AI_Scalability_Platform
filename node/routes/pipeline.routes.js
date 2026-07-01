import express from "express";
import {
  getAllPipelines,
  getPipelineById,
} from "../controllers/pipeline.controller.js";

const router = express.Router();

// GET /pipelines - Get all pipelines
router.get("/", getAllPipelines);

// GET /pipelines/:id - Get specific pipeline by ID
router.get("/:id", getPipelineById);

export default router;
