import express from "express";
import { chatWithLineageAI } from "../controllers/lineageAI.controller.js";

const router = express.Router();

router.post("/chat", chatWithLineageAI);

export default router;
