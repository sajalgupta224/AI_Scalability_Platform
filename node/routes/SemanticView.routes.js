
// backend/routes/semanticview.routes.js
import express from "express";
import { semanticHealth } from "../controllers/SemanticView.controller.js";

const router = express.Router();

router.get("/health", semanticHealth);

export default router;
