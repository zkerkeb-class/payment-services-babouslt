import { Router } from "express";
import {
  createSubscriptionController,
  handleSubscriptionWebhook,
  cancelSubscriptionController,
  getSubscriptionController,
} from "../controllers/subscription.controller";
import {
  validateCreateSubscription,
  handleValidationErrors,
} from "../middlewares/validators";

const router = Router();

// Route pour créer un abonnement
router.post(
  "/create",
  validateCreateSubscription,
  handleValidationErrors,
  createSubscriptionController
);

// Route pour annuler un abonnement
router.put("/:subscriptionId/cancel", cancelSubscriptionController);

// Route pour récupérer un abonnement
router.get("/:subscriptionId", getSubscriptionController);

// Route pour les webhooks d'abonnement Stripe
router.post("/webhook", handleSubscriptionWebhook);

export default router;
