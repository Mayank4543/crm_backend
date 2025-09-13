// Validation middleware
const Joi = require("joi");

// Validate request body against a schema
const validate = (schema) => {
  return (req, res, next) => {
    console.log('Validating request body:', JSON.stringify(req.body, null, 2));
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      allowUnknown: true,  // Allow unknown fields for now
      stripUnknown: true,  // Remove unknown fields
      convert: true        // Convert types automatically
    });
    
    if (error) {
      console.error('Validation error:', error.details);
      return res.status(400).json({
        status: "error",
        message: error.details[0].message,
        field: error.details[0].path.join('.'),
        details: error.details
      });
    }
    
    console.log('Validation successful, cleaned data:', JSON.stringify(value, null, 2));
    // Replace req.body with validated and cleaned data
    req.body = value;
    next();
  };
};

// Define validation schemas
const schemas = {
  // Customer validation schema
  customerSchema: Joi.object({
    first_name: Joi.string().trim().required(),
    last_name: Joi.string().trim().required(),
    email: Joi.string().email().trim().required(),
    phone: Joi.string().trim().allow("", null).optional(),
    address: Joi.string().trim().allow("", null).optional(),
    total_spend: Joi.number().min(0).optional().default(0),
    total_visits: Joi.number().integer().min(0).optional().default(0),
    last_visit_date: Joi.string().allow("", null).optional(),
    tags: Joi.array().items(Joi.string()).optional().default([]),
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
