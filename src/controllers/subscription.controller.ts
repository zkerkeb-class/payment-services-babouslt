import { Request, Response } from "express";
import { Subscription } from "../models/subscription.model";
import {
  createCustomer,
  createProduct,
  createPrice,
  createSubscription,
  cancelSubscription,
  retrieveSubscription,
} from "../utils/stripe";
import {
  updateUserToPremium,
  removeUserFromPremium,
} from "../utils/userService";

export const createSubscriptionController = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId, email, amount = 6.99, currency = "eur" } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        message: "userId et email sont requis",
      });
    }

    // Créer le client Stripe
    const customer = await createCustomer(email, { userId });

    // Créer le produit
    const product = await createProduct(
      "Abonnement Premium",
      "Accès premium mensuel"
    );

    // Créer le prix mensuel
    const price = await createPrice(product.id, amount, currency, "month");

    // Créer l'abonnement
    const subscription = await createSubscription(customer.id, price.id, {
      userId,
    });

    // Sauvegarder l'abonnement en base de données
    const subscriptionDoc = new Subscription({
      userId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: price.id,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000)
        : null,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
    });

    await subscriptionDoc.save();

    // Sauvegarder l'ID d'abonnement dans le profil utilisateur
    try {
      const response = await fetch(
        `${
          process.env.BDD_SERVICE_URL || "http://localhost:3001/api"
        }/users/${userId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer dummy-token`,
          },
          body: JSON.stringify({ stripeSubscriptionId: subscription.id }),
        }
      );

      if (!response.ok) {
        // Erreur lors de la sauvegarde de l'ID d'abonnement
      }
    } catch (error) {
      // Erreur lors de la sauvegarde de l'ID d'abonnement
      // On continue même si ça échoue
    }

    // Retourner les informations pour le frontend
    const clientSecret =
      typeof subscription.latest_invoice === "object" &&
      subscription.latest_invoice &&
      typeof subscription.latest_invoice.payment_intent === "object" &&
      subscription.latest_invoice.payment_intent?.client_secret;

    res.status(201).json({
      success: true,
      message: "Abonnement créé avec succès",
      data: {
        subscriptionId: subscription.id,
        clientSecret,
        status: subscription.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erreur lors de la création de l'abonnement",
      error: error instanceof Error ? error.message : "Erreur inconnue",
    });
  }
};

export const handleSubscriptionWebhook = async (
  req: Request,
  res: Response
) => {
  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    return res.status(400).json({
      success: false,
      message: "Signature Stripe manquante",
    });
  }

  try {
    const event = require("../utils/stripe").constructWebhookEvent(
      req.body,
      sig
    );

    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
      // Événement d'abonnement non géré
    }

    res.json({ received: true });
  } catch (error) {
    // Erreur lors du traitement du webhook d'abonnement
    res.status(400).json({
      success: false,
      message: "Erreur lors du traitement du webhook",
      error: error instanceof Error ? error.message : "Erreur inconnue",
    });
  }
};

const handleSubscriptionCreated = async (subscription: any) => {
  try {
    const { id: subscriptionId, metadata, status } = subscription;
    const userId = metadata.userId;

    if (userId) {
      if (status === "active") {
        await updateUserToPremium(userId, "dummy-token");
        // Statut premium activé via webhook (création)
      } else if (status === "incomplete") {
        // Abonnement créé avec statut incomplete
        // Ne pas donner le statut premium tant que le paiement n'est pas complété
      }
    }
  } catch (error) {
    // Erreur lors du traitement de la création d'abonnement
  }
};

const handleSubscriptionUpdated = async (subscription: any) => {
  try {
    const { id: subscriptionId, status, metadata } = subscription;
    const userId = metadata.userId;

    // Mettre à jour le statut en base de données
    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: subscriptionId },
      {
        status,
        currentPeriodStart: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000)
          : null,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
      }
    );

    // Mettre à jour le statut premium de l'utilisateur
    if (userId) {
      if (status === "active") {
        await updateUserToPremium(userId, "dummy-token");
        // Statut premium activé via webhook pour l'utilisateur
      } else if (
        ["canceled", "unpaid", "past_due", "incomplete"].includes(status)
      ) {
        // Retirer le statut premium si l'abonnement est annulé ou incomplet
        await removeUserFromPremium(userId, "dummy-token");
        // Statut premium retiré via webhook pour l'utilisateur
      }
    }
  } catch (error) {
    // Erreur lors du traitement de la mise à jour d'abonnement
  }
};

const handleSubscriptionDeleted = async (subscription: any) => {
  try {
    const { id: subscriptionId, metadata } = subscription;
    const userId = metadata.userId;

    // Marquer l'abonnement comme supprimé
    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: subscriptionId },
      { status: "canceled" }
    );

    // Retirer le statut premium
    if (userId) {
      await removeUserFromPremium(userId, "dummy-token");
      // Statut premium retiré via webhook (suppression) pour l'utilisateur
    }
  } catch (error) {
    // Erreur lors du traitement de la suppression d'abonnement
  }
};

const handleInvoicePaymentSucceeded = async (invoice: any) => {
  try {
    const { subscription: subscriptionId } = invoice;

    // Mettre à jour le statut de l'abonnement
    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: subscriptionId },
      { status: "active" }
    );
  } catch (error) {
    // Erreur lors du traitement du paiement d'invoice
  }
};

const handleInvoicePaymentFailed = async (invoice: any) => {
  try {
    const { subscription: subscriptionId } = invoice;

    // Mettre à jour le statut de l'abonnement
    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: subscriptionId },
      { status: "past_due" }
    );
  } catch (error) {
    // Erreur lors du traitement de l'échec de paiement d'invoice
  }
};

export const cancelSubscriptionController = async (
  req: Request,
  res: Response
) => {
  try {
    const { subscriptionId } = req.params;
    const { cancelAtPeriodEnd = true } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "ID d'abonnement requis",
      });
    }

    console.log(`Tentative d'annulation de l'abonnement: ${subscriptionId}`);

    const subscription = await cancelSubscription(
      subscriptionId,
      cancelAtPeriodEnd
    );

    // Mettre à jour en base de données
    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: subscriptionId },
      {
        cancelAtPeriodEnd,
        status: subscription.status,
      }
    );

    // Retirer le statut premium immédiatement
    try {
      // Récupérer l'utilisateur associé à cet abonnement
      const subscriptionDoc = await Subscription.findOne({
        stripeSubscriptionId: subscriptionId,
      });
      if (subscriptionDoc && subscriptionDoc.userId) {
        await removeUserFromPremium(subscriptionDoc.userId, "dummy-token");
        // Statut premium retiré pour l'utilisateur
      }
    } catch (error) {
      // Erreur lors de la suppression du statut premium
      // On continue même si ça échoue
    }

    res.json({
      success: true,
      message: cancelAtPeriodEnd
        ? "Abonnement annulé à la fin de la période"
        : "Abonnement annulé immédiatement",
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    // Erreur lors de l'annulation de l'abonnement
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'annulation de l'abonnement",
      error: error instanceof Error ? error.message : "Erreur inconnue",
    });
  }
};

export const getSubscriptionController = async (
  req: Request,
  res: Response
) => {
  try {
    const { subscriptionId } = req.params;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "ID d'abonnement requis",
      });
    }

    const subscription = await retrieveSubscription(subscriptionId);

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    // Erreur lors de la récupération de l'abonnement
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de l'abonnement",
      error: error instanceof Error ? error.message : "Erreur inconnue",
    });
  }
};
