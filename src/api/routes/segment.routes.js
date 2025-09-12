const express = require("express");
const { validate, schemas } = require("../middlewares/validation.middleware");
const segmentService = require("../../services/segment.service");

const router = express.Router();

// Create segment validation schema
const segmentSchema = {
  name: require("joi").string().required(),
  description: require("joi").string().allow("").optional(),
  rules: require("joi").object().required(),
};

const validateSegmentCreation = validate(require("joi").object(segmentSchema));

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

    const audienceSize = await segmentService.previewSegmentAudience(
      segment.rules,
      req.user.id
    );

    res.status(200).json({
      success: true,
      data: {
        audienceSize,
      },
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
