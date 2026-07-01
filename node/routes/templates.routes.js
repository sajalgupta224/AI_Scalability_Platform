
import express from "express";
import {
  getTemplates,
  registerTemplate,
} from "../controllers/templates.controller.js";

const router = express.Router();

// GET  /api/templates
router.get("/", getTemplates);

// POST /api/templates
router.post("/", registerTemplate);

export default router;
