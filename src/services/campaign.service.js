// Campaign service
const supabase = require("../config/database");
const { publisher, channels } = require("../config/redis");
const customerService = require("./customer.service");
const messageService = require("./message.service");
const aiService = require("./ai.service");

// Create a new campaign
const createCampaign = async (campaignData, userId) => {
  // Add user ID to campaign data
  const campaign = {
    ...campaignData,
    created_by: userId,
    audienceSize: 0,
    sentCount: 0,
    failedCount: 0,
    status: "PENDING",
    created_at: new Date().toISOString(),
  };

  // Save campaign to database
  const { data, error } = await supabase
    .from("campaigns")
    .insert([campaign])
    .select()
    .single();

  if (error) {
    console.error("Error creating campaign:", error);
    throw new Error("Failed to create campaign");
  }

  // Publish to Redis for async processing
  await publisher.publish(
    channels.CAMPAIGN_CREATED,
    JSON.stringify({
      campaignId: data.id,
      timestamp: new Date().toISOString(),
    })
  );

  return data;
};

// Get campaigns with pagination
const getCampaigns = async (userId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("campaigns")
    .select("*", { count: "exact" })
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error getting campaigns:", error);
    throw new Error("Failed to get campaigns");
  }

  return {
    campaigns: data,
    total: count,
  };
};

// Get all campaigns
const getAllCampaigns = async (userId) => {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting campaigns:", error);
    throw new Error("Failed to get campaigns");
  }

  return data;
};

// Get campaign by ID for specific user
const getCampaignByIdForUser = async (id, userId) => {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("created_by", userId)
    .single();

  if (error) {
    console.error("Error getting campaign:", error);
    return null; // Return null instead of throwing error for 404 handling
  }

  return data;
};

// Get campaign by ID
const getCampaignById = async (id) => {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error getting campaign:", error);
    throw new Error("Failed to get campaign");
  }

  return data;
};

// Update campaign
const updateCampaign = async (id, updateData) => {
  const { data, error } = await supabase
    .from("campaigns")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating campaign:", error);
    throw new Error("Failed to update campaign");
  }

  return data;
};

// Preview audience size
const previewAudienceSize = async (rules) => {
  const count = await customerService.countCustomersBySegment(rules);
  return { count };
};

// Process campaign (used by consumer)
const processCampaign = async (campaignId) => {
  try {
    // Get campaign details
    const campaign = await getCampaignById(campaignId);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Find customers matching the segment
    const customers = await customerService.findCustomersBySegment(
      campaign.rules
    );

    // Update audience size
    await updateCampaign(campaignId, {
      audienceSize: customers.length,
      status: "PROCESSING",
    });

    // Process each customer
    for (const customer of customers) {
      try {
        // Generate personalized message
        const personalizedMessage = await aiService.personalizeMessage(
          campaign.message,
          customer
        );

        // Send message via vendor API
        await messageService.sendMessage({
          customerId: customer.id,
          campaignId: campaignId,
          message: personalizedMessage,
        });
      } catch (error) {
        console.error(`Error processing customer ${customer.id}:`, error);
        // Continue with other customers even if one fails
      }
    }

    // Update campaign status
    await updateCampaign(campaignId, { status: "COMPLETED" });

    return { status: "success", message: "Campaign processed successfully" };
  } catch (error) {
    console.error("Error processing campaign:", error);

    // Update campaign status to FAILED
    await updateCampaign(campaignId, { status: "FAILED" });

    throw new Error("Failed to process campaign");
  }
};

// Get campaign analytics
const getCampaignAnalytics = async (campaignId) => {
  // Get campaign details
  const campaign = await getCampaignById(campaignId);

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Get communication logs for the campaign
  const { data: logs, error } = await supabase
    .from("communication_logs")
    .select("*")
    .eq("campaignId", campaignId);

  if (error) {
    console.error("Error getting campaign logs:", error);
    throw new Error("Failed to get campaign logs");
  }

  // Calculate metrics
  const totalSent = logs.filter((log) => log.status === "SENT").length;
  const totalFailed = logs.filter((log) => log.status === "FAILED").length;
  const deliveryRate =
    campaign.audienceSize > 0 ? (totalSent / campaign.audienceSize) * 100 : 0;

  // Generate summary with AI
  const summary = await aiService.generateCampaignSummary({
    campaign,
    totalSent,
    totalFailed,
    deliveryRate,
  });

  return {
    campaign,
    metrics: {
      audienceSize: campaign.audienceSize,
      sent: totalSent,
      failed: totalFailed,
      deliveryRate: deliveryRate.toFixed(2) + "%",
    },
    summary,
  };
};

// Get campaign stats
const getCampaignStats = async (campaignId, userId) => {
  const campaign = await getCampaignByIdForUser(campaignId, userId);

  if (!campaign) {
    return null;
  }

  // Get communication logs for the campaign
  const { data: logs, error } = await supabase
    .from("communication_logs")
    .select("status")
    .eq("campaignId", campaignId);

  if (error) {
    console.error("Error getting campaign logs:", error);
    throw new Error("Failed to get campaign stats");
  }

  const sent = logs.filter((log) => log.status === "SENT").length;
  const failed = logs.filter((log) => log.status === "FAILED").length;
  const pending = logs.filter((log) => log.status === "PENDING").length;

  return {
    ...campaign,
    stats: {
      sent,
      failed,
      pending,
      deliveryRate:
        campaign.audienceSize > 0
          ? ((sent / campaign.audienceSize) * 100).toFixed(2) + "%"
          : "0%",
    },
  };
};

// Preview campaign audience
const previewCampaignAudience = async (rules, userId) => {
  return await customerService.countCustomersBySegment(rules);
};

module.exports = {
  createCampaign,
  getCampaigns,
  getAllCampaigns,
  getCampaignById,
  getCampaignByIdForUser,
  getCampaignStats,
  updateCampaign,
  previewAudienceSize,
  previewCampaignAudience,
  processCampaign,
  getCampaignAnalytics,
};
