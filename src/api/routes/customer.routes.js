const express = require("express");
const { validate, schemas } = require("../middlewares/validation.middleware");
const validateCustomerCreation = validate(schemas.customerSchema);
const customerService = require("../../services/customer.service");

const router = express.Router();

router.post("/", validateCustomerCreation, async (req, res, next) => {
  try {
    const result = await customerService.createCustomer(req.body, req.user?.id);

    res.status(201).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const result = await customerService.getCustomers(req.user?.id, page, limit);

    res.status(200).json({
      success: true,
      data: result.customers || result, // Handle both paginated and simple responses
      pagination: result.total ? {
        total: result.total,
        page,
        limit,
        pages: Math.ceil(result.total / limit),
      } : undefined,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const customer = await customerService.getCustomerById(req.params.id, req.user?.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
