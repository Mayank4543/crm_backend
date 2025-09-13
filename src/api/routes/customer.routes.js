const express = require("express");
const { validate, schemas } = require("../middlewares/validation.middleware");
const validateCustomerCreation = validate(schemas.customerSchema);
const customerService = require("../../services/customer.service");

const router = express.Router();


// Regular customer creation with validation
router.post("/", validateCustomerCreation, async (req, res, next) => {
  try {
    console.log("Customer creation request body:", req.body);
    const result = await customerService.createCustomer(req.body);

    res.status(201).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("Customer creation error:", err);
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await customerService.getCustomers(
      page,
      limit
    );

    res.status(200).json({
      success: true,
      data: result.customers || result, // Handle both paginated and simple responses
      pagination: result.total
        ? {
            total: result.total,
            page,
            limit,
            pages: Math.ceil(result.total / limit),
          }
        : undefined,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const customer = await customerService.getCustomerById(
      req.params.id
    );

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

router.put("/:id", validateCustomerCreation, async (req, res, next) => {
  try {
    console.log("Customer update request for ID:", req.params.id, "Body:", req.body);
    const result = await customerService.updateCustomer(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("Customer update error:", err);
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    console.log("Customer delete request for ID:", req.params.id);
    const result = await customerService.deleteCustomer(req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    console.error("Customer delete error:", err);
    next(err);
  }
});

module.exports = router;
