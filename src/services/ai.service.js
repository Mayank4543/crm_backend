/**
 * AI Service
 * Handles AI-powered features for the CRM platform
 */
const axios = require("axios");
const supabase = require("../config/database");

// In a real application, you would use OpenAI API or other AI service
// For demonstration, we'll create simulated AI functionality

/**
 * Convert natural language to segment rules
 * @param {string} naturalLanguage - Natural language description of audience segment
 * @returns {Object} - Segment rules object
 */
const naturalLanguageToRules = async (naturalLanguage) => {
  try {
    console.log("Converting natural language to rules:", naturalLanguage);

    // In a real app, you would call an AI API like OpenAI
    // Here we'll use a simple rule-based approach for demonstration

    const rules = { operator: "AND", conditions: [] };

    // Parse spending conditions
    if (
      naturalLanguage.match(/spent\s+(over|more than)\s+([₹$])?(\d[\d,.]*)/i)
    ) {
      const match = naturalLanguage.match(
        /spent\s+(over|more than)\s+([₹$])?(\d[\d,.]*)/i
      );
      const amount = parseFloat(match[3].replace(/,/g, ""));

      rules.conditions.push({
        field: "total_spend",
        operation: "greaterThan",
        value: amount,
      });
    }

    // Parse visit conditions
    if (naturalLanguage.match(/visits?\s+(less than|under|<)\s+(\d+)/i)) {
      const match = naturalLanguage.match(
        /visits?\s+(less than|under|<)\s+(\d+)/i
      );
      const visits = parseInt(match[2]);

      rules.conditions.push({
        field: "total_visits",
        operation: "lessThan",
        value: visits,
      });
    }

    // Parse inactivity conditions
    if (
      naturalLanguage.match(/inactive\s+for\s+(\d+)\s+(days|months|years)/i)
    ) {
      const match = naturalLanguage.match(
        /inactive\s+for\s+(\d+)\s+(days|months|years)/i
      );
      const duration = parseInt(match[1]);
      const unit = match[2];

      let daysAgo = duration;
      if (unit === "months") daysAgo = duration * 30;
      if (unit === "years") daysAgo = duration * 365;

      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const isoDate = date.toISOString();

      rules.conditions.push({
        field: "last_visit_date",
        operation: "lessThan",
        value: isoDate,
      });
    }

    // If no conditions were detected, return a default rule
    if (rules.conditions.length === 0) {
      rules.conditions.push({
        field: "total_spend",
        operation: "greaterThan",
        value: 0,
      });
    }

    // If the query contains "OR", change the operator
    if (naturalLanguage.includes(" OR ") || naturalLanguage.includes(" or ")) {
      rules.operator = "OR";
    }

    return rules;
  } catch (err) {
    console.error("Error converting natural language to rules:", err);
    throw new Error("Failed to convert natural language to rules");
  }
};

/**
 * Generate message suggestions based on campaign objective
 * @param {string} objective - Campaign objective
 * @param {Object} segmentData - Segment data
 * @returns {Array} - Array of message suggestions
 */
const generateMessageSuggestions = async (objective, segmentData) => {
  try {
    console.log("Generating message suggestions for objective:", objective);

    // In a real app, you would call an AI API
    // Here we'll use pre-defined templates based on the objective

    const suggestions = [];
    const templates = {
      win_back: [
        "Hi {firstName}, we miss you! Come back and enjoy 15% off your next purchase.",
        "Hi {firstName}, it's been a while! Here's a special 20% discount just for you.",
        "{firstName}, we haven't seen you in a while. How about free shipping on your next order?",
      ],
      high_value: [
        "Hi {firstName}, as one of our VIP customers, enjoy early access to our new collection!",
        "Thank you for your loyalty, {firstName}! Here's a special 25% off for our top customers.",
        "Exclusive offer for you, {firstName}! Enjoy premium benefits on your next purchase.",
      ],
      new_product: [
        "Hi {firstName}, check out our newest products - perfect for you based on your past purchases!",
        "{firstName}, we've just launched something we think you'll love. Take a look!",
        "New arrival alert, {firstName}! Based on your taste, we think you'll love our latest collection.",
      ],
      default: [
        "Hi {firstName}, here's 10% off on your next order!",
        "Special offer for you, {firstName}! Save 15% on your next purchase.",
        "Thank you for being our customer, {firstName}! Here's a special offer just for you.",
      ],
    };

    // Determine category based on objective keywords
    let category = "default";
    if (objective.match(/inactive|win back|return|come back/i)) {
      category = "win_back";
    } else if (objective.match(/vip|premium|loyal|high(\s+|-)?value/i)) {
      category = "high_value";
    } else if (objective.match(/new product|launch|release|collection/i)) {
      category = "new_product";
    }

    // Return the suggestions for the determined category
    return templates[category];
  } catch (err) {
    console.error("Error generating message suggestions:", err);
    throw new Error("Failed to generate message suggestions");
  }
};

/**
 * Generate campaign performance summary
 * @param {string} campaignId - Campaign ID
 * @returns {string} - Human-readable summary
 */
const generateCampaignSummary = async (campaignId) => {
  try {
    console.log("Generating campaign summary for:", campaignId);

    // Get campaign data
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*, segments(*)")
      .eq("id", campaignId)
      .single();

    if (campaignError) {
      console.error("Error fetching campaign:", campaignError);
      throw new Error("Failed to fetch campaign data");
    }

    // Get delivery statistics
    const { data: logs, error: logsError } = await supabase
      .from("communication_logs")
      .select("status, customers(total_spend)")
      .eq("campaign_id", campaignId);

    if (logsError) {
      console.error("Error fetching logs:", logsError);
      throw new Error("Failed to fetch delivery logs");
    }

    // Calculate high-value delivery rate (customers with >10K spend)
    const highValueLogs = logs.filter(
      (log) => log.customers?.total_spend > 10000
    );
    const highValueSent = highValueLogs.filter(
      (log) => log.status === "SENT"
    ).length;
    const highValueRate =
      highValueLogs.length > 0
        ? Math.round((highValueSent / highValueLogs.length) * 100)
        : 0;

    // Generate summary
    return `Your campaign "${campaign.name}" reached ${
      campaign.audience_size
    } users. ${campaign.sent_count} messages were delivered. ${
      campaign.failed_count
    } messages failed to deliver. ${
      highValueLogs.length > 0
        ? `Customers with > ₹10K spend had a ${highValueRate}% delivery rate.`
        : ""
    }`;
  } catch (err) {
    console.error("Error generating campaign summary:", err);
    throw new Error("Failed to generate campaign summary");
  }
};

/**
 * Auto-tag a campaign based on audience and message
 * @param {string} message - Campaign message
 * @param {Object} segmentRules - Segment rules
 * @returns {Array} - List of tags
 */
const autoTagCampaign = async (message, segmentRules) => {
  try {
    console.log("Auto-tagging campaign");

    const tags = [];

    // Check message for common themes
    if (message.match(/discount|% off|save|deal|offer/i)) {
      tags.push("discount");
    }

    if (message.match(/new|launch|introducing|just arrived/i)) {
      tags.push("new-product");
    }

    if (message.match(/limited time|soon|hurry|ends|last chance/i)) {
      tags.push("limited-time");
    }

    if (message.match(/thank you|thanks for|appreciate|grateful/i)) {
      tags.push("appreciation");
    }

    // Check segment rules for audience types
    const rulesStr = JSON.stringify(segmentRules);

    if (rulesStr.includes("total_spend") && rulesStr.includes("greaterThan")) {
      tags.push("high-value-customers");
    }

    if (rulesStr.includes("last_visit_date") && rulesStr.includes("lessThan")) {
      tags.push("win-back");
    }

    if (rulesStr.includes("total_visits") && rulesStr.includes("greaterThan")) {
      tags.push("loyal-customers");
    }

    // Return unique tags
    return [...new Set(tags)];
  } catch (err) {
    console.error("Error auto-tagging campaign:", err);
    throw new Error("Failed to auto-tag campaign");
  }
};

/**
 * Suggest the best time to send campaigns
 * @param {string} segmentId - Segment ID to analyze
 * @returns {Object} - Suggested times with confidence scores
 */
const suggestCampaignSchedule = async (segmentId) => {
  try {
    console.log("Generating schedule suggestions for segment:", segmentId);

    // Get customer interaction data for the segment
    const { data: customers, error } = await supabase
      .from("customers")
      .select("last_active_time, active_days")
      .eq("segment_id", segmentId);

    if (error) {
      throw new Error("Failed to fetch customer data");
    }

    // Analyze activity patterns (simplified for demo)
    const activityByHour = new Array(24).fill(0);
    const activityByDay = {
      MONDAY: 0,
      TUESDAY: 0,
      WEDNESDAY: 0,
      THURSDAY: 0,
      FRIDAY: 0,
      SATURDAY: 0,
      SUNDAY: 0,
    };

    // Process customer activity data
    customers.forEach((customer) => {
      if (customer.last_active_time) {
        const date = new Date(customer.last_active_time);
        activityByHour[date.getHours()]++;
      }
      if (customer.active_days) {
        customer.active_days.forEach((day) => {
          activityByDay[day]++;
        });
      }
    });

    // Find best hours (top 3)
    const bestHours = activityByHour
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(({ hour }) => hour);

    // Find best days (top 3)
    const bestDays = Object.entries(activityByDay)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([day]) => day);

    return {
      bestTimes: bestHours.map((hour) => ({
        time: `${hour}:00`,
        confidence: "high",
      })),
      bestDays: bestDays.map((day) => ({
        day,
        confidence: "high",
      })),
      recommendation: `Best time to send: ${bestDays[0]} at ${bestHours[0]}:00`,
    };
  } catch (err) {
    console.error("Error suggesting campaign schedule:", err);
    throw new Error("Failed to generate schedule suggestions");
  }
};

/**
 * Generate lookalike audience based on successful campaign
 * @param {string} campaignId - Source campaign ID
 * @returns {Object} - New segment rules for lookalike audience
 */
const generateLookalikeAudience = async (campaignId) => {
  try {
    console.log("Generating lookalike audience for campaign:", campaignId);

    // Get successful deliveries from the campaign
    const { data: successfulDeliveries, error: deliveryError } = await supabase
      .from("communication_logs")
      .select("customer_id")
      .eq("campaign_id", campaignId)
      .eq("status", "SENT");

    if (deliveryError) {
      throw new Error("Failed to fetch successful deliveries");
    }

    // Get customer profiles for successful deliveries
    const customerIds = successfulDeliveries.map((d) => d.customer_id);
    const { data: customers, error: customerError } = await supabase
      .from("customers")
      .select("total_spend, total_visits, last_visit_date")
      .in("id", customerIds);

    if (customerError) {
      throw new Error("Failed to fetch customer profiles");
    }

    // Analyze customer characteristics
    const avgSpend =
      customers.reduce((sum, c) => sum + (c.total_spend || 0), 0) /
      customers.length;
    const avgVisits =
      customers.reduce((sum, c) => sum + (c.total_visits || 0), 0) /
      customers.length;

    // Generate rules for lookalike audience
    const lookalikeRules = {
      operator: "AND",
      conditions: [
        {
          field: "total_spend",
          operation: "greaterThan",
          value: avgSpend * 0.8, // 80% of average spend
        },
        {
          field: "total_visits",
          operation: "greaterThan",
          value: Math.floor(avgVisits * 0.8), // 80% of average visits
        },
      ],
    };

    return {
      rules: lookalikeRules,
      insights: {
        sourceAudienceSize: customers.length,
        avgSpend: Math.round(avgSpend),
        avgVisits: Math.round(avgVisits),
        recommendation:
          "Targeting similar customers with comparable spending and engagement patterns",
      },
    };
  } catch (err) {
    console.error("Error generating lookalike audience:", err);
    throw new Error("Failed to generate lookalike audience");
  }
};

module.exports = {
  naturalLanguageToRules,
  generateMessageSuggestions,
  generateCampaignSummary,
  autoTagCampaign,
  suggestCampaignSchedule,
  generateLookalikeAudience,
};
