const express = require("express");
const aiService = require("../../services/ai.service");
const auth = require("../middlewares/auth.middleware");

const router = express.Router();

// Convert natural language to segment rules
router.post("/natural-language", auth, async (req, res, next) => {
  try {
    const rules = await aiService.naturalLanguageToRules(req.body.text);
    res.json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
});

// Generate message suggestions
router.post("/message-suggestions", auth, async (req, res, next) => {
  try {
    const suggestions = await aiService.generateMessageSuggestions(
      req.body.objective,
      req.body.segmentData
    );
    res.json({ success: true, data: suggestions });
  } catch (err) {
    next(err);
  }
});

// Auto-tag campaign
router.post("/auto-tag", auth, async (req, res, next) => {
  try {
    const tags = await aiService.autoTagCampaign(
      req.body.message,
      req.body.segmentRules
    );
    res.json({ success: true, data: tags });
  } catch (err) {
    next(err);
  }
});

// Suggest campaign schedule
router.get("/schedule/:segmentId", auth, async (req, res, next) => {
  try {
    const schedule = await aiService.suggestCampaignSchedule(
      req.params.segmentId
    );
    res.json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
});

// Generate lookalike audience
router.get("/lookalike/:campaignId", auth, async (req, res, next) => {
  try {
    const lookalike = await aiService.generateLookalikeAudience(
      req.params.campaignId
    );
    res.json({ success: true, data: lookalike });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
