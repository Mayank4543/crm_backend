/**
 * Customer Consumer
 * Handles customer data persistence from Redis pub/sub
 */
const { redisClient, channels } = require("../config/redis");
const supabase = require("../config/database");

/**
 * Process customer creation message
 * @param {Object} data - Customer data
 */
const processCustomerCreation = async (data) => {
  try {
    console.log("Processing customer creation:", data.email);

    const { data: customer, error } = await supabase
      .from("customers")
      .insert([
        {
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          address: data.address,
          tags: data.tags || [],
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating customer:", error);
      return;
    }

    console.log("Customer created successfully:", customer.id);
  } catch (err) {
    console.error("Customer consumer error:", err);
  }
};

/**
 * Start customer consumer
 */
const startCustomerConsumer = async () => {
  try {
    // Subscribe to customer creation channel
    await redisClient.subscribe(channels.CUSTOMER_CREATED, async (message) => {
      try {
        const data = JSON.parse(message);
        await processCustomerCreation(data);
      } catch (err) {
        console.error("Error processing customer message:", err);
      }
    });

    console.log("Customer consumer started");
  } catch (err) {
    console.error("Error starting customer consumer:", err);
  }
};

module.exports = { startCustomerConsumer };
