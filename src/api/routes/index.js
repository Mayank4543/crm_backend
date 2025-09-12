const express = require("express");
const customerRoutes = require("./customer.routes");
const campaignRoutes = require("./campaign.routes");
const orderRoutes = require("./order.routes");
const authRoutes = require("./auth.routes");
const aiRoutes = require("./ai.routes");

const router = express.Router();

// Register routes
router.use("/customers", customerRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/orders", orderRoutes);
router.use("/auth", authRoutes);
router.use("/ai", aiRoutes);

module.exports = router;
