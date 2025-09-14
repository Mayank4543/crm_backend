const express = require("express");
const { validate, schemas } = require("../middlewares/validation.middleware");
const campaignService = require("../../services/campaign.service");
const aiService = require("../../services/ai.service");

const router = express.Router();
const validateCampaignCreation = validate(schemas.campaignSchema);

router.post("/", validateCampaignCreation, async (req, res, next) => {
  try {
    const result = await campaignService.createCampaign(req.body, req.user.id);

    res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      campaignId: result.id,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    // Prevent 304 Not Modified responses
    res.setHeader("Cache-Control", "no-cache");

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await campaignService.getCampaigns(req.user.id, page, limit);

    res.status(200).json({
      success: true,
      data: result.campaigns,
      pagination: {
        total: result.total,
        page,
        limit,
        pages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const campaign = await campaignService.getCampaignByIdForUser(
      req.params.id,
      req.user.id
    );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/stats", async (req, res, next) => {
  try {
    const stats = await campaignService.getCampaignStats(
      req.params.id,
      req.user.id
    );

    if (!stats) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/preview", async (req, res, next) => {
  try {
    const { rules } = req.body;

    if (!rules) {
      return res.status(400).json({
        success: false,
        message: "Rules are required",
      });
    }

    const result = await campaignService.previewCampaignAudience(
      rules,
      req.user.id
    );

    res.status(200).json({
      success: true,
      data: {
        audienceSize: result.audienceSize || result.count || 0,
        count: result.audienceSize || result.count || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", validateCampaignCreation, async (req, res, next) => {
  try {
    // Check if campaign exists and belongs to user
    const existingCampaign = await campaignService.getCampaignByIdForUser(
      req.params.id,
      req.user.id
    );

    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Only prevent editing campaigns that are currently processing/sending
    if (["processing", "sending"].includes(existingCampaign.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot edit campaign while it's being processed",
      });
    }

    const result = await campaignService.updateCampaignForUser(
      req.params.id,
      req.body,
      req.user.id
    );

    res.status(200).json({
      success: true,
      message: "Campaign updated successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    // Check if campaign exists and belongs to user
    const existingCampaign = await campaignService.getCampaignByIdForUser(
      req.params.id,
      req.user.id
    );

    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Don't allow deleting campaigns that are processing
    if (["processing", "sending"].includes(existingCampaign.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete campaign while it's being processed",
      });
    }

    await campaignService.deleteCampaignForUser(req.params.id, req.user.id);

    res.status(200).json({
      success: true,
      message: "Campaign deleted successfully",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/execute", async (req, res, next) => {
  try {
    // Check if campaign exists and belongs to user
    const existingCampaign = await campaignService.getCampaignByIdForUser(
      req.params.id,
      req.user.id
    );

    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Check if campaign can be executed (allow draft, failed, completed, and pending campaigns)
    if (["processing", "sending"].includes(existingCampaign.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot execute campaign with status: ${existingCampaign.status}. Campaign is currently being processed.`,
      });
    }

    // Execute the campaign
    const result = await campaignService.executeCampaign(req.params.id, req.user.id);

    res.status(200).json({
      success: true,
      message: "Campaign executed successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/suggestions", async (req, res, next) => {
  try {
    const { segmentId, purpose } = req.body;

    if (!segmentId || !purpose) {
      return res.status(400).json({
        success: false,
        message: "segmentId and purpose are required",
      });
    }

    const suggestions = await aiService.generateMessageSuggestions(
      segmentId,
      purpose,
      req.user.id
    );

    res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
