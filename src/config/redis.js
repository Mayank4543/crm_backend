// Redis configuration
const Redis = require("redis");
const dotenv = require("dotenv");

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create separate clients for publishing and subscribing
const publisher = Redis.createClient({ url: REDIS_URL });
const subscriber = publisher.duplicate();

// Connect clients
(async () => {
  try {
    await Promise.all([publisher.connect(), subscriber.connect()]);
    console.log("Connected to Redis (publisher and subscriber)");
  } catch (err) {
    console.error("Redis connection error:", err);
  }
})();

// Handle Redis errors
publisher.on("error", (err) => console.error("Redis publisher error:", err));
subscriber.on("error", (err) => console.error("Redis subscriber error:", err));

module.exports = {
  publisher,
  subscriber,
  // Define Redis channels/streams
  channels: {
    CUSTOMER_CREATED: "customer:created",
    CUSTOMER_UPDATED: "customer:updated",
    CUSTOMER_DELETED: "customer:deleted",
    ORDER_CREATED: "order:created",
    CAMPAIGN_CREATED: "campaign:created",
    DELIVERY_STATUS: "delivery:status",
  },
};
