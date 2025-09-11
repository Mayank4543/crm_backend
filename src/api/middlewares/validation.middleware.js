// Validation middleware
const Joi = require("joi");

// Validate request body against a schema
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.details[0].message,
      });
    }
    next();
  };
};

// Define validation schemas
const schemas = {
  // Customer validation schema
  customerSchema: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().allow("").optional(),
    address: Joi.string().allow("").optional(),
  }),

  // Order validation schema
  orderSchema: Joi.object({
    customerId: Joi.string().required(),
    amount: Joi.number().positive().required(),
    products: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
          name: Joi.string().required(),
          price: Joi.number().positive().required(),
          quantity: Joi.number().integer().positive().required(),
        })
      )
      .required(),
  }),

  // Campaign validation schema
  campaignSchema: Joi.object({
    name: Joi.string().required(),
    rules: Joi.object().required(),
    message: Joi.string().required(),
  }),

  // Campaign preview validation schema
  campaignPreviewSchema: Joi.object({
    rules: Joi.object().required(),
  }),

  // Delivery receipt validation schema
  deliveryReceiptSchema: Joi.object({
    messageId: Joi.string().required(),
    status: Joi.string().valid("SENT", "FAILED").required(),
    customerId: Joi.string().required(),
    campaignId: Joi.string().required(),
  }),
};

// Create specific validation middlewares
const validateCustomerCreation = validate(schemas.customerSchema);
const validateOrderCreation = validate(schemas.orderSchema);
const validateCampaignCreation = validate(schemas.campaignSchema);
const validateCampaignPreview = validate(schemas.campaignPreviewSchema);
const validateDeliveryReceipt = validate(schemas.deliveryReceiptSchema);

module.exports = {
  validate,
  schemas,
  validateCustomerCreation,
  validateOrderCreation,
  validateCampaignCreation,
  validateCampaignPreview,
  validateDeliveryReceipt,
};
