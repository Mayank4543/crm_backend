const express = require("express");
const { validate, schemas } = require("../middlewares/validation.middleware");
const segmentService = require("../../services/segment.service");

const router = express.Router();

// Create segment validation schema
const segmentSchema = {
  name: require("joi").string().required(),
  description: require("joi").string().allow("").optional(),
  rules: require("joi").object().required(),
  is_dynamic: require("joi").boolean().optional().default(true),
  tags: require("joi").array().items(require("joi").string()).optional().default([]),
};

const validateSegmentCreation = validate(require("joi").object(segmentSchema));

// Test database connection and segments table structure
router.get("/test-db", async (req, res, next) => {
  try {
    const supabase = require("../../config/database");
    
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from("segments")
      .select("*")
      .limit(1);
    
    if (testError) {
      return res.status(500).json({
        success: false,
        message: "Database connection test failed",
        error: testError.message
      });
    }

    // Check table structure
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("*")
      .limit(1);

    res.status(200).json({
      success: true,
      message: "Database connection successful",
      segments_test: testData,
      customers_test: customers,
      segments_error: testError,
      customers_error: customersError
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Database test failed",
      error: err.message
    });
  }
});

// Create a new segment
router.post("/", validateSegmentCreation, async (req, res, next) => {
  try {
    const result = await segmentService.createSegment(req.body, req.user.id);

    res.status(201).json({
      success: true,
      message: "Segment created successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// Get all segments
router.get("/", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await segmentService.getSegments(req.user.id, page, limit);

    res.status(200).json({
      success: true,
      data: result.segments,
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

// Get segment by ID
router.get("/:id", async (req, res, next) => {
  try {
    const segment = await segmentService.getSegmentById(
      req.params.id,
      req.user.id
    );

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: "Segment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: segment,
    });
  } catch (err) {
    next(err);
  }
});

// Preview rules (without saving segment)
router.post("/preview", async (req, res, next) => {
  try {
    console.log('Preview request body:', JSON.stringify(req.body, null, 2));
    
    const { rules } = req.body;
    
    if (!rules) {
      return res.status(400).json({
        success: false,
        message: "Rules are required for preview",
      });
    }

    console.log('Calling previewSegmentAudience with rules:', rules);
    const audiencePreview = await segmentService.previewSegmentAudience(
      rules,
      req.user.id
    );

    console.log('Preview result:', audiencePreview);
    res.status(200).json({
      success: true,
      data: audiencePreview,
    });
  } catch (err) {
    console.error('Preview error:', err);
    next(err);
  }
});

// Preview segment audience
router.post("/:id/preview", async (req, res, next) => {
  try {
    const segment = await segmentService.getSegmentById(
      req.params.id,
      req.user.id
    );

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: "Segment not found",
      });
    }

    const audiencePreview = await segmentService.previewSegmentAudience(
      segment.rules,
      req.user.id
    );

    res.status(200).json({
      success: true,
      data: audiencePreview,
    });
  } catch (err) {
    next(err);
  }
});

// Update segment
router.put("/:id", validateSegmentCreation, async (req, res, next) => {
  try {
    const segment = await segmentService.updateSegment(
      req.params.id,
      req.body,
      req.user.id
    );

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: "Segment not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Segment updated successfully",
      data: segment,
    });
  } catch (err) {
    next(err);
  }
});

// Delete segment
router.delete("/:id", async (req, res, next) => {
  try {
    const result = await segmentService.deleteSegment(
      req.params.id,
      req.user.id
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Segment not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Segment deleted successfully",
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
