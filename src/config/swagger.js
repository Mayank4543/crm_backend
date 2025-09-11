// Swagger documentation configuration
module.exports = {
  openapi: '3.0.0',
  info: {
    title: 'CRM Application API',
    version: '1.0.0',
    description: 'API documentation for the CRM Application'
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {
    '/api/auth/google': {
      get: {
        tags: ['Authentication'],
        summary: 'Google OAuth login',
        description: 'Redirects to Google for authentication',
        security: [],
        responses: {
          302: {
            description: 'Redirect to Google'
          }
        }
      }
    },
    '/api/auth/google/callback': {
      get: {
        tags: ['Authentication'],
        summary: 'Google OAuth callback',
        description: 'Callback URL for Google OAuth',
        security: [],
        responses: {
          302: {
            description: 'Redirect to frontend with token'
          }
        }
      }
    },
    '/api/customers': {
      post: {
        tags: ['Customers'],
        summary: 'Create a new customer',
        description: 'Add a new customer to the CRM system',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Customer created successfully'
          },
          400: {
            description: 'Invalid input'
          }
        }
      },
      get: {
        tags: ['Customers'],
        summary: 'Get all customers',
        description: 'Retrieve all customers from the CRM system',
        responses: {
          200: {
            description: 'List of customers'
          }
        }
      }
    },
    '/api/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Create a new order',
        description: 'Add a new order to the CRM system',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customerId: { type: 'string' },
                  amount: { type: 'number' },
                  products: { type: 'array' }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Order created successfully'
          },
          400: {
            description: 'Invalid input'
          }
        }
      },
      get: {
        tags: ['Orders'],
        summary: 'Get all orders',
        description: 'Retrieve all orders from the CRM system',
        responses: {
          200: {
            description: 'List of orders'
          }
        }
      }
    },
    '/api/campaigns': {
      post: {
        tags: ['Campaigns'],
        summary: 'Create a new campaign',
        description: 'Create a new campaign with segment rules',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  rules: { type: 'object' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Campaign created successfully'
          },
          400: {
            description: 'Invalid input'
          }
        }
      },
      get: {
        tags: ['Campaigns'],
        summary: 'Get all campaigns',
        description: 'Retrieve all campaigns from the CRM system',
        responses: {
          200: {
            description: 'List of campaigns'
          }
        }
      }
    },
    '/api/campaigns/preview': {
      post: {
        tags: ['Campaigns'],
        summary: 'Preview campaign audience',
        description: 'Get the size of the audience for a campaign with given rules',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rules: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Audience size'
          },
          400: {
            description: 'Invalid input'
          }
        }
      }
    },
    '/api/delivery/receipt': {
      post: {
        tags: ['Delivery'],
        summary: 'Delivery receipt webhook',
        description: 'Webhook for delivery status updates from the vendor API',
        security: [],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  messageId: { type: 'string' },
                  status: { type: 'string', enum: ['SENT', 'FAILED'] },
                  customerId: { type: 'string' },
                  campaignId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Receipt processed successfully'
          },
          400: {
            description: 'Invalid input'
          }
        }
      }
    }
  }
};
