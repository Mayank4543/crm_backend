// Message service for sending messages to customers
const axios = require("axios");
const supabase = require("../config/database");
const { publisher, channels } = require("../config/redis");

// Simulated vendor API URL (in a real app, this would be an actual API endpoint)
const VENDOR_API_URL = "https://api.example.com/send-message"; // Replace with real vendor API

// Send a message to a customer
const sendMessage = async (messageData) => {
  try {
    // Log the message in the database first
    const { data: logEntry, error } = await supabase
      .from("communication_logs")
      .insert([
        {
          customerId: messageData.customerId,
          campaignId: messageData.campaignId,
          message: messageData.message,
          status: "PENDING",
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error logging message:", error);
      throw new Error("Failed to log message");
    }

    // Simulate vendor API call
    // In a real application, this would be an actual API call to a messaging service
    // For simulation, we'll randomly succeed or fail with 90% success rate
    const isSuccess = Math.random() < 0.9;

    // In a real app, this would be an actual API request
    // const response = await axios.post(VENDOR_API_URL, {
    //   messageId: logEntry.id,
    //   customerId: messageData.customerId,
    //   message: messageData.message
    // });

    // Simulate the API response
    const simulatedResponse = {
      status: 200,
      data: {
        messageId: logEntry.id,
        status: isSuccess ? "SENT" : "FAILED",
      },
    };

    // Update the log with the delivery status
    await updateMessageStatus(
      logEntry.id,
      simulatedResponse.data.status,
      messageData.customerId,
      messageData.campaignId
    );

    return {
      success: true,
      messageId: logEntry.id,
      status: simulatedResponse.data.status,
    };
  } catch (error) {
    console.error("Error sending message:", error);
    throw new Error("Failed to send message");
  }
};

// Update message status (used by delivery receipt webhook)
const updateMessageStatus = async (
  messageId,
  status,
  customerId,
  campaignId
) => {
  // Publish to Redis for async batch processing
  await publisher.publish(
    channels.DELIVERY_STATUS,
    JSON.stringify({
      messageId,
      status,
      customerId,
      campaignId,
      timestamp: new Date().toISOString(),
    })
  );

  return { status: "success", message: "Status update queued" };
};

// Batch update message statuses (used by consumer)
const batchUpdateMessageStatuses = async (updates) => {
  try {
    // Group updates by campaign for efficient updating
    const campaignUpdates = {};

    // Process each message status update
    for (const update of updates) {
      // Update individual message log
      const { error } = await supabase
        .from("communication_logs")
        .update({ status: update.status, updated_at: new Date().toISOString() })
        .eq("id", update.messageId);

      if (error) {
        console.error("Error updating message status:", error);
        continue; // Continue with other updates even if one fails
      }

      // Track campaign stats for batch update
      if (!campaignUpdates[update.campaignId]) {
        campaignUpdates[update.campaignId] = {
          sent: 0,
          failed: 0,
        };
      }

      if (update.status === "SENT") {
        campaignUpdates[update.campaignId].sent++;
      } else if (update.status === "FAILED") {
        campaignUpdates[update.campaignId].failed++;
      }
    }

    // Batch update campaign stats
    for (const [campaignId, stats] of Object.entries(campaignUpdates)) {
      const { data: campaign, error } = await supabase
        .from("campaigns")
        .select("sentCount, failedCount")
        .eq("id", campaignId)
        .single();

      if (error) {
        console.error("Error getting campaign stats:", error);
        continue;
      }

      // Update campaign stats
      const { error: updateError } = await supabase
        .from("campaigns")
        .update({
          sentCount: (campaign.sentCount || 0) + stats.sent,
          failedCount: (campaign.failedCount || 0) + stats.failed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      if (updateError) {
        console.error("Error updating campaign stats:", updateError);
      }
    }

    return { status: "success", message: "Batch update completed" };
  } catch (error) {
    console.error("Error in batch update:", error);
    throw new Error("Failed to batch update message statuses");
  }
};

// Track message event (used by delivery event webhook)
const trackMessageEvent = async (messageId, event, timestamp, metadata) => {
  // For now, we'll just log the event to the console
  // In a real application, you might store these events in a separate table
  console.log(`Message ${messageId} event: ${event} at ${timestamp}`, metadata);

  // You could store events in a separate table:
  // const { error } = await supabase
  //   .from('message_events')
  //   .insert([{
  //     messageId,
  //     event,
  //     timestamp,
  //     metadata,
  //     created_at: new Date().toISOString()
  //   }]);

  return { status: "success", message: "Event tracked" };
};

module.exports = {
  sendMessage,
  updateMessageStatus,
  batchUpdateMessageStatuses,
  trackMessageEvent,
};
