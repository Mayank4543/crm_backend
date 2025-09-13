const express = require("express");
const {
  naturalLanguageToRules,
  generateMessageSuggestions,
  generateCampaignSummary,
  autoTagCampaign,
  suggestCampaignSchedule,
  generateLookalikeAudience,
  generateSchedulingSuggestions,
} = require("../../services/ai.service");
const { authenticateJWT } = require("../middlewares/auth.middleware");

const router = express.Router();


router.post("/natural-language-to-rules", authenticateJWT, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        status: "error",
        message: "Query is required",
      });
    }

    const rules = await naturalLanguageToRules(query);

    res.json({
      status: "success",
      data: rules,
    });
  } catch (error) {
    console.error("Error in natural-language-to-rules:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to convert natural language to rules",
    });
  }
});


router.post("/message-suggestions", authenticateJWT, async (req, res) => {
  try {
    const { objective, segmentData } = req.body;

    if (!objective) {
      return res.status(400).json({
        status: "error",
        message: "Objective is required",
      });
    }

    const suggestions = await generateMessageSuggestions(
      objective,
      segmentData || {}
    );

    res.json({
      status: "success",
      data: suggestions,
    });
  } catch (error) {
    console.error("Error in message-suggestions:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to generate message suggestions",
    });
  }
});


router.post("/scheduling-suggestions", authenticateJWT, async (req, res) => {
  try {
    const { campaignData, segmentRules } = req.body;

    if (!campaignData) {
      return res.status(400).json({
        status: "error",
        message: "Campaign data is required",
      });
    }

    const suggestions = await generateSchedulingSuggestions(
      campaignData,
      segmentRules || {}
    );

    res.json({
      status: "success",
      data: suggestions,
    });
  } catch (error) {
    console.error("Error in scheduling-suggestions:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to generate scheduling suggestions",
    });
  }
});

router.post("/campaign-summary", authenticateJWT, async (req, res) => {
  try {
    const { campaignId } = req.body;

    if (!campaignId) {
      return res.status(400).json({
        status: "error",
        message: "Campaign ID is required",
      });
    }

    const summary = await generateCampaignSummary(campaignId);

    res.json({
      status: "success",
      data: { summary },
    });
  } catch (error) {
    console.error("Error in campaign-summary:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to generate campaign summary",
    });
  }
});



router.post("/auto-tag", authenticateJWT, async (req, res) => {
  try {
    const { message, segmentRules } = req.body;

    if (!message) {
      return res.status(400).json({
        status: "error",
        message: "Message is required",
      });
    }

    const tags = await autoTagCampaign(message, segmentRules || {});

    res.json({
      status: "success",
      data: tags,
    });
  } catch (error) {
    console.error("Error in auto-tag:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to auto-tag campaign",
    });
  }
});


router.post("/campaign-schedule", authenticateJWT, async (req, res) => {
  try {
    const { segmentId } = req.body;

    if (!segmentId) {
      return res.status(400).json({
        status: "error",
        message: "Segment ID is required",
      });
    }

    const schedule = await suggestCampaignSchedule(segmentId);

    res.json({
      status: "success",
      data: schedule,
    });
  } catch (error) {
    console.error("Error in campaign-schedule:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to suggest campaign schedule",
    });
  }
});


router.post("/lookalike-audience", authenticateJWT, async (req, res) => {
  try {
    const { campaignId } = req.body;

    if (!campaignId) {
      return res.status(400).json({
        status: "error",
        message: "Campaign ID is required",
      });
    }

    const lookalike = await generateLookalikeAudience(campaignId);

    res.json({
      status: "success",
      data: lookalike,
    });
  } catch (error) {
    console.error("Error in lookalike-audience:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to generate lookalike audience",
    });
  }
});

// Debug endpoint to check AI model status
router.get("/status", authenticateJWT, async (req, res) => {
  try {
    const { initializeModelOnDemand } = require("../../services/ai.service");
    
    res.json({
      status: "success",
      data: {
        message: "AI service is running",
        modelLoaded: global.isModelInitialized || false,
        timestamp: new Date().toISOString()
      },
    });
  } catch (error) {
    console.error("Error in AI status:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to get AI status",
    });
  }
});

module.exports = router;
