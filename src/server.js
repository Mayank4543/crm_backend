const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const passport = require("passport");
const dotenv = require("dotenv");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const apiRoutes = require("./api/routes");
const aiRoutes = require("./api/routes/ai.routes");
const { initializeModel, cleanupModel } = require("./services/ai.service");

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require("./api/routes/auth.routes");
const customerRoutes = require("./api/routes/customer.routes");
const orderRoutes = require("./api/routes/order.routes");
const campaignRoutes = require("./api/routes/campaign.routes");
const segmentRoutes = require("./api/routes/segment.routes");
const deliveryRoutes = require("./api/routes/delivery.routes");

// Import middleware
const { authenticateJWT } = require("./api/middlewares/auth.middleware");

// Import config
require("./config/passport");

// Verify database
const { initializeDatabase } = require("./models/index");

// Initialize express app
const app = express();

const startServer = async () => {
  // Initialize AI Model
  await initializeModel();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan("dev"));
  app.use(passport.initialize());

  // API Documentation
  const swaggerDocument = require("./config/swagger");
  const swaggerOptions = {
    explorer: true,
  };
  app.use("/api-docs", swaggerUi.serve);
  app.use("/api-docs", swaggerUi.setup(swaggerDocument, swaggerOptions));

  // Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/customers", authenticateJWT, customerRoutes);
  app.use("/api/orders", authenticateJWT, orderRoutes);
  app.use("/api/campaigns", authenticateJWT, campaignRoutes);
  app.use("/api/segments", authenticateJWT, segmentRoutes);
  app.use("/api/delivery", deliveryRoutes); // No auth for delivery webhooks
  app.use("/api/ai", aiRoutes); // AI endpoints with authentication handled in routes

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
      status: "error",
      message: err.message || "Internal Server Error",
    });
  });

  // Start the server
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);

    // Verify database tables
    try {
      await initializeDatabase();
    } catch (err) {
      console.error("Database verification error:", err);
    }
  });

  // Start Redis consumers
  require("./consumers");
};

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Received SIGINT. Graceful shutdown...");
  cleanupModel();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Graceful shutdown...");
  cleanupModel();
  process.exit(0);
});

startServer();
