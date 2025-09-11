/**
 * Campaign Consumer
 * Handles campaign processing and message delivery
 */
const { redisClient, channels } = require("../config/redis");
const supabase = require("../config/database");
const { sendMessage } = require("../services/message.service");

/**
 * Process campaign creation message
 * @param {Object} data - Campaign data
 */
const processCampaignCreation = async (data) => {
  try {
    console.log("Processing campaign creation:", data.name);

    // Get the segment to find target audience
    const { data: segment, error: segmentError } = await supabase
      .from("segments")
      .select("rules")
      .eq("id", data.segmentId)
      .single();

    if (segmentError) {
      console.error("Error fetching segment:", segmentError);
      return;
    }

    // Get target customers based on segment rules
    const customers = await getTargetCustomers(segment.rules);
    const audienceSize = customers.length;

    // Update campaign with audience size
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({
        audience_size: audienceSize,
        status: "sending",
      })
      .eq("id", data.id);

    if (updateError) {
      console.error("Error updating campaign:", updateError);
      return;
    }

    console.log(`Sending campaign to ${audienceSize} customers`);

    // Deliver messages to each customer
    let sentCount = 0;
    let failedCount = 0;

    for (const customer of customers) {
      try {
        // Personalize message
        const personalizedMessage = data.messageTemplate
          .replace(/\{firstName\}/g, customer.first_name)
          .replace(/\{lastName\}/g, customer.last_name)
          .replace(/\{email\}/g, customer.email);

        // Create communication log entry
        const { data: commLog, error: commError } = await supabase
          .from("communication_logs")
          .insert([
            {
              campaign_id: data.id,
              customer_id: customer.id,
              message: personalizedMessage,
              status: "pending",
            },
          ])
          .select()
          .single();

        if (commError) {
          console.error("Error creating communication log:", commError);
          failedCount++;
          continue;
        }

        // Send message through vendor API
        const result = await sendMessage({
          to: customer.email,
          message: personalizedMessage,
          deliveryId: commLog.id,
        });

        // Message sent successfully
        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error("Error sending message to customer:", customer.id, err);
        failedCount++;
      }
    }

    // Update campaign stats
    await supabase
      .from("campaigns")
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        status: "completed",
      })
      .eq("id", data.id);

    console.log(`Campaign completed: ${sentCount} sent, ${failedCount} failed`);
  } catch (err) {
    console.error("Campaign consumer error:", err);

    // Update campaign as failed
    await supabase
      .from("campaigns")
      .update({
        status: "failed",
      })
      .eq("id", data.id);
  }
};

/**
 * Get target customers based on segment rules
 * @param {Object} rules - Segment rules
 * @returns {Array} - List of matching customers
 */
const getTargetCustomers = async (rules) => {
  try {
    // Convert segment rules to SQL query
    let query = supabase.from("customers").select("*");

    // Process rules recursively
    query = applyRules(query, rules);

    // Execute query
    const { data: customers, error } = await query;

    if (error) {
      console.error("Error querying customers:", error);
      return [];
    }

    return customers;
  } catch (err) {
    console.error("Error getting target customers:", err);
    return [];
  }
};

/**
 * Apply segment rules to Supabase query
 * @param {Object} query - Supabase query
 * @param {Object} rules - Segment rules
 * @returns {Object} - Modified query
 */
const applyRules = (query, rules) => {
  // Check if this is a group of rules
  if (rules.operator && rules.conditions) {
    // Process each condition
    rules.conditions.forEach((condition) => {
      if (rules.operator === "AND") {
        query = applyRules(query, condition);
      } else if (rules.operator === "OR") {
        // OR conditions are more complex in Supabase
        // For simplicity, we'll handle basic cases
        if (condition.field && condition.operation) {
          query = applyFilter(query, condition, true);
        } else {
          query = applyRules(query, condition);
        }
      }
    });
  }
  // Check if this is a single condition
  else if (rules.field && rules.operation) {
    query = applyFilter(query, rules);
  }

  return query;
};

/**
 * Apply a single filter condition to the query
 * @param {Object} query - Supabase query
 * @param {Object} condition - Filter condition
 * @param {boolean} isOr - Whether this is an OR condition
 * @returns {Object} - Modified query
 */
const applyFilter = (query, condition, isOr = false) => {
  const { field, operation, value } = condition;

  const filterMethod = isOr ? "or" : "and";

  switch (operation) {
    case "equals":
      return query[filterMethod](`${field}.eq.${value}`);
    case "notEquals":
      return query[filterMethod](`${field}.neq.${value}`);
    case "greaterThan":
      return query[filterMethod](`${field}.gt.${value}`);
    case "lessThan":
      return query[filterMethod](`${field}.lt.${value}`);
    case "contains":
      if (field === "tags") {
        // For array fields
        return query[filterMethod](`${field}.cs.{${value}}`);
      }
      return query[filterMethod](`${field}.ilike.%${value}%`);
    case "notContains":
      if (field === "tags") {
        // For array fields
        return query[filterMethod](`not.${field}.cs.{${value}}`);
      }
      return query[filterMethod](`not.${field}.ilike.%${value}%`);
    case "isEmpty":
      return query[filterMethod](`${field}.is.null`);
    case "isNotEmpty":
      return query[filterMethod](`${field}.is.not.null`);
    default:
      return query;
  }
};

/**
 * Process delivery status update message
 * @param {Object} data - Delivery status data
 */
const processDeliveryStatus = async (data) => {
  try {
    console.log("Processing delivery status update:", data.deliveryId);

    // Update communication log with delivery status
    const { error } = await supabase
      .from("communication_logs")
      .update({
        status: data.status,
        sent_at: data.status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", data.deliveryId);

    if (error) {
      console.error("Error updating delivery status:", error);
      return;
    }

    // If sent, increment campaign sent count
    // If failed, increment campaign failed count
    if (data.campaignId) {
      const updateField =
        data.status === "sent" ? "sent_count" : "failed_count";

      // Get current count
      const { data: campaign, error: fetchError } = await supabase
        .from("campaigns")
        .select(updateField)
        .eq("id", data.campaignId)
        .single();

      if (fetchError) {
        console.error("Error fetching campaign:", fetchError);
        return;
      }

      // Update count
      const { error: updateError } = await supabase
        .from("campaigns")
        .update({
          [updateField]: (campaign[updateField] || 0) + 1,
        })
        .eq("id", data.campaignId);

      if (updateError) {
        console.error("Error updating campaign count:", updateError);
        return;
      }
    }

    console.log("Delivery status updated successfully");
  } catch (err) {
    console.error("Delivery status consumer error:", err);
  }
};

/**
 * Start campaign consumer
 */
const startCampaignConsumer = async () => {
  try {
    // Subscribe to campaign creation channel
    await redisClient.subscribe(channels.CAMPAIGN_CREATED, async (message) => {
      try {
        const data = JSON.parse(message);
        await processCampaignCreation(data);
      } catch (err) {
        console.error("Error processing campaign message:", err);
      }
    });

    // Subscribe to delivery status channel
    await redisClient.subscribe(channels.DELIVERY_STATUS, async (message) => {
      try {
        const data = JSON.parse(message);
        await processDeliveryStatus(data);
      } catch (err) {
        console.error("Error processing delivery status message:", err);
      }
    });

    console.log("Campaign consumer started");
  } catch (err) {
    console.error("Error starting campaign consumer:", err);
  }
};

module.exports = { startCampaignConsumer };
