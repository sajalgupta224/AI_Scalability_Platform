import express from "express";
import {
  saveNotificationEmail,
  verifyNotificationEmail,
  sendTestEmail,
  notifyOnError,
} from "../controllers/settings.controller.js";

const router = express.Router();

router.post("/save-email", saveNotificationEmail);
router.get("/verify", verifyNotificationEmail);
router.post("/test", sendTestEmail);
router.post("/notify-error", notifyOnError);

export default router;
