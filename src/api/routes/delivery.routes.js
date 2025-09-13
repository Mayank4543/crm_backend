const express = require("express");
const messageService = require("../../services/message.service");
const { validate, schemas } = require("../middlewares/validation.middleware");

const router = express.Router();

// Delivery receipt endpoint for vendor API callbacks
router.post("/receipt", validate(schemas.deliveryReceiptSchema), async (req, res, next) => {
  try {
    const { messageId, status, customerId, campaignId } = req.body;

    // Process the delivery receipt
    await messageService.updateMessageStatus(messageId, status, customerId, campaignId);

    // Always respond with 200 to vendor API
    res.status(200).json({
      success: true,
      message: "Delivery receipt processed"
    });
  } catch (err) {
    console.error("Error processing delivery receipt:", err);
    // Still return 200 to prevent vendor retries
    res.status(200).json({
      success: false,
      message: "Error processing receipt, but acknowledged"
    });
  }
});

router.post("/webhook", async (req, res, next) => {
  try {
    // Extract data from the webhook payload
    const { messageId, status, metadata } = req.body;

    if (!messageId || !status) {
      return res.status(400).json({
        success: false,
        message: "messageId and status are required",
      });
    }

    // Process the webhook
    await messageService.updateMessageStatus(messageId, status, metadata);

    // Always respond with 200 to webhook provider
    res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  } catch (err) {
    console.error("Error processing delivery webhook:", err);
    // Still return 200 to the webhook provider to prevent retries
    res.status(200).json({
      success: false,
      message: "Error processing webhook, but acknowledged",
    });
  }
});


router.post("/events", async (req, res, next) => {
  try {
    // Extract data from the event payload
    const { messageId, event, timestamp, metadata } = req.body;

    if (!messageId || !event) {
      return res.status(400).json({
        success: false,
        message: "messageId and event are required",
      });
    }

    // Process the event
    await messageService.trackMessageEvent(
      messageId,
      event,
      timestamp,
      metadata
    );

    // Always respond with 200 to event provider
    res.status(200).json({
      success: true,
      message: "Event received",
    });
  } catch (err) {
    console.error("Error processing delivery event:", err);
    // Still return 200 to the event provider to prevent retries
    res.status(200).json({
      success: false,
      message: "Error processing event, but acknowledged",
    });
  }
});

module.exports = router;
