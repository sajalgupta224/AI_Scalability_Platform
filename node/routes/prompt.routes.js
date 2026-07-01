import express from "express";
import {
  getAllPrompts,
  getPromptById,
} from "../controllers/prompt.controller.js";

const router = express.Router();

// GET /prompts - Get all prompts
router.get("/", getAllPrompts);

// GET /prompts/:id - Get specific prompt by ID
router.get("/:id", getPromptById);

export default router;
