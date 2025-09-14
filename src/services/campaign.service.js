// Campaign service
const supabase = require("../config/database");
const { publisher, channels } = require("../config/redis");
const customerService = require("./customer.service");
const messageService = require("./message.service");
const emailService = require("./email.service");
const aiService = require("./ai.service");

// Create a new campaign
const createCampaign = async (campaignData, userId) => {
  // Map frontend fields to database fields
  const campaign = {
    name: campaignData.name,
    segment_id: campaignData.segmentId,
    message_template: campaignData.messageTemplate,
    created_by: userId,
    audience_size: 0,
    sent_count: 0,
    failed_count: 0,
    status: "draft",
    tags: campaignData.tags || [],
    ai_summary: campaignData.objective || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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

  // Get segment to calculate audience size
  try {
    const { data: segment } = await supabase
      .from("segments")
      .select("rules")
      .eq("id", campaignData.segmentId)
      .single();

    if (segment && segment.rules) {
      const audienceSize = await customerService.countCustomersBySegment(
        segment.rules
      );

      // Update campaign with actual audience size
      const { data: updatedCampaign } = await supabase
        .from("campaigns")
        .update({ audience_size: audienceSize })
        .eq("id", data.id)
        .select()
        .single();

      if (updatedCampaign) {
        data.audience_size = audienceSize;
      }
    }
  } catch (segmentError) {
    console.error("Error calculating audience size:", segmentError);
    // Don't fail the campaign creation if audience size calculation fails
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

// Update campaign for specific user
const updateCampaignForUser = async (id, updateData, userId) => {
  // Map frontend fields to database fields if needed
  const mappedData = {
    name: updateData.name,
    segment_id: updateData.segmentId || updateData.segment_id,
    message_template: updateData.messageTemplate || updateData.message_template,
    tags: updateData.tags || [],
    ai_summary: updateData.objective || updateData.ai_summary,
    status: updateData.status, // Allow status updates
    updated_at: new Date().toISOString(),
  };

  // Remove undefined values
  Object.keys(mappedData).forEach(key => {
    if (mappedData[key] === undefined) {
      delete mappedData[key];
    }
  });

  const { data, error } = await supabase
    .from("campaigns")
    .update(mappedData)
    .eq("id", id)
    .eq("created_by", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating campaign:", error);
    throw new Error("Failed to update campaign");
  }

  // If segment changed, recalculate audience size
  if (mappedData.segment_id) {
    try {
      const { data: segment } = await supabase
        .from("segments")
        .select("rules")
        .eq("id", mappedData.segment_id)
        .single();

      if (segment && segment.rules) {
        const audienceSize = await customerService.countCustomersBySegment(
          segment.rules
        );

        const { data: updatedCampaign } = await supabase
          .from("campaigns")
          .update({ audience_size: audienceSize })
          .eq("id", id)
          .eq("created_by", userId)
          .select()
          .single();

        if (updatedCampaign) {
          data.audience_size = audienceSize;
        }
      }
    } catch (segmentError) {
      console.error("Error recalculating audience size:", segmentError);
    }
  }

  return data;
};

// Delete campaign for specific user
const deleteCampaignForUser = async (id, userId) => {
  // First delete related communication logs
  const { error: logsError } = await supabase
    .from("communication_logs")
    .delete()
    .eq("campaignId", id);

  if (logsError) {
    console.error("Error deleting communication logs:", logsError);
    // Don't throw error, continue with campaign deletion
  }

  // Delete the campaign
  const { data, error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id)
    .eq("created_by", userId)
    .select()
    .single();

  if (error) {
    console.error("Error deleting campaign:", error);
    throw new Error("Failed to delete campaign");
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
  try {
    const audienceSize = await customerService.countCustomersBySegment(rules);
    return { audienceSize, count: audienceSize };
  } catch (error) {
    console.error("Error previewing campaign audience:", error);
    return { audienceSize: 0, count: 0 };
  }
};

// Execute campaign - send emails to target audience
const executeCampaign = async (campaignId, userId) => {
  try {
    console.log(`Starting campaign execution for campaign: ${campaignId}`);
    
    // Get campaign details
    const campaign = await getCampaignByIdForUser(campaignId, userId);
    if (!campaign) {
      throw new Error("Campaign not found or unauthorized");
    }

    // Allow re-execution of all campaigns except currently processing ones
    if (["PROCESSING", "processing", "sending"].includes(campaign.status)) {
      throw new Error("Campaign is currently being processed");
    }

    // Update campaign status to PROCESSING
    await updateCampaign(campaignId, { 
      status: "PROCESSING",
      updated_at: new Date().toISOString()
    });

    // Get segment details
    const { data: segment } = await supabase
      .from("segments")
      .select("rules")
      .eq("id", campaign.segment_id)
      .single();

    if (!segment) {
      throw new Error("Segment not found");
    }

    // Find customers matching the segment
    const customers = await customerService.findCustomersBySegment(segment.rules);
    console.log(`Found ${customers.length} customers matching segment criteria`);

    if (customers.length === 0) {
      await updateCampaign(campaignId, { 
        status: "COMPLETED",
        updated_at: new Date().toISOString(),
        sent_count: 0,
        failed_count: 0
      });
      return { 
        success: true, 
        message: "No customers found matching segment criteria",
        sent: 0,
        failed: 0
      };
    }

    let sentCount = 0;
    let failedCount = 0;
    const emailResults = [];

    // Process each customer
    for (const customer of customers) {
      try {
        // Personalize message template
        const personalizedMessage = emailService.personalizeMessage(
          campaign.message_template, 
          customer
        );

        // Create a personalized subject line
        const subjectLine = `${customer.first_name}, Special Offer Just for You! - ${campaign.name}`;

        // Generate HTML email
        const htmlContent = emailService.generateEmailHTML(personalizedMessage, customer);

        // Send email
        const emailResult = await emailService.sendEmail({
          to: customer.email,
          subject: subjectLine,
          text: personalizedMessage,
          html: htmlContent
        });

        if (emailResult.success) {
          sentCount++;
          console.log(`Email sent successfully to: ${customer.email}`);
        } else {
          failedCount++;
          console.log(`Failed to send email to: ${customer.email}`, emailResult.error);
        }

        // Log communication
        await supabase.from("communication_logs").insert([{
          customer_id: customer.id,
          campaign_id: campaignId,
          message: personalizedMessage,
          status: emailResult.status,
          sent_at: emailResult.success ? new Date().toISOString() : null,
          error_message: emailResult.error || null,
          message_id: emailResult.messageId || null
        }]);

        emailResults.push({
          customer: customer.email,
          status: emailResult.status,
          messageId: emailResult.messageId
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        failedCount++;
        console.error(`Error processing customer ${customer.email}:`, error);
        
        // Log failed communication
        await supabase.from("communication_logs").insert([{
          customer_id: customer.id,
          campaign_id: campaignId,
          message: campaign.message_template,
          status: "FAILED",
          error_message: error.message,
          sent_at: new Date().toISOString()
        }]);
      }
    }

    // Update campaign with final results
    await updateCampaign(campaignId, {
      status: "COMPLETED",
      updated_at: new Date().toISOString(),
      sent_count: sentCount,
      failed_count: failedCount,
      audience_size: customers.length
    });

    console.log(`Campaign execution completed. Sent: ${sentCount}, Failed: ${failedCount}`);

    return {
      success: true,
      message: "Campaign executed successfully",
      sent: sentCount,
      failed: failedCount,
      total: customers.length,
      results: emailResults
    };

  } catch (error) {
    console.error("Error executing campaign:", error);
    
    // Update campaign status to FAILED
    await updateCampaign(campaignId, { 
      status: "FAILED",
      updated_at: new Date().toISOString()
    });

    throw new Error(`Failed to execute campaign: ${error.message}`);
  }
};

module.exports = {
  createCampaign,
  getCampaigns,
  getAllCampaigns,
  getCampaignById,
  getCampaignByIdForUser,
  getCampaignStats,
  updateCampaign,
  updateCampaignForUser,
  deleteCampaignForUser,
  previewAudienceSize,
  previewCampaignAudience,
  processCampaign,
  getCampaignAnalytics,
  executeCampaign,
};
