import express from "express";
import {
  getAllChatbots,
  getChatbotById,
  getChatbotHistory,
  getAllDeployments,
  createChatbot,
  deployChatbot,
  saveChatbotResponse
} from "../controllers/chatbot.controller.js";

const router = express.Router();

// GET /chatbots - Get all chatbots
router.get("/", getAllChatbots);

// GET /chatbots/deployments - Get all chatbot deployments
router.get("/deployments", getAllDeployments);

// GET /chatbots/:id - Get specific chatbot by ID
router.get("/:id", getChatbotById);

// GET /chatbots/:id/history - Get chatbot history/responses
router.get("/:id/history", getChatbotHistory);

// POST /chatbots/create - Create new Chatbot
router.post('/create', createChatbot);

// POST /chatbots/deploy - Deploy Chatbot
router.post('/deploy', deployChatbot);

// POST /chatbots/response - Save chatbot response
router.post('/response', saveChatbotResponse);

export default router;
