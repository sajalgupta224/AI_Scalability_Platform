// node/routes/apiRoutes.js
import express from "express";
import {
  getCurrentRole,
  getCurrentAccess,
  updateRolePermission,
  getUsersWithRole,
} from "../controllers/apiController.js";

const router = express.Router();

router.get("/current-role", getCurrentRole);
router.get("/current-access", getCurrentAccess);
router.post("/role-permissions/update", updateRolePermission);
router.get("/currentUserWithRole", getUsersWithRole);

export default router;