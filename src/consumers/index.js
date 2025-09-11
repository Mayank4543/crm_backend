/**
 * Main Consumer Module
 * Initializes all Redis consumers
 */
const { startCustomerConsumer } = require("./customer.consumer");
const { startOrderConsumer } = require("./order.consumer");
const { startCampaignConsumer } = require("./campaign.consumer");

/**
 * Initialize all Redis consumers
 */
const initializeConsumers = async () => {
  try {
    console.log("Initializing Redis consumers...");

    // Start all consumers
    await startCustomerConsumer();
    await startOrderConsumer();
    await startCampaignConsumer();

    console.log("All Redis consumers initialized successfully");
  } catch (err) {
    console.error("Error initializing Redis consumers:", err);
  }
};

// Start consumers
initializeConsumers();

module.exports = { initializeConsumers };
