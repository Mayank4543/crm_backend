/**
 * Order Consumer
 * Handles order data persistence from Redis pub/sub
 */
const { redisClient, channels } = require("../config/redis");
const supabase = require("../config/database");

/**
 * Process order creation message
 * @param {Object} data - Order data
 */
const processOrderCreation = async (data) => {
  try {
    console.log("Processing order creation:", data.orderNumber);

    // Create the order
    const { data: order, error } = await supabase
      .from("orders")
      .insert([
        {
          customer_id: data.customerId,
          order_number: data.orderNumber,
          amount: data.amount,
          items: data.items,
          status: data.status || "completed",
          order_date: data.orderDate || new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating order:", error);
      return;
    }

    console.log("Order created successfully:", order.id);

    // Update customer metrics
    await updateCustomerMetrics(data.customerId, data.amount);
  } catch (err) {
    console.error("Order consumer error:", err);
  }
};

/**
 * Update customer metrics based on new order
 * @param {string} customerId - Customer ID
 * @param {number} amount - Order amount
 */
const updateCustomerMetrics = async (customerId, amount) => {
  try {
    // Get current customer data
    const { data: customer, error: fetchError } = await supabase
      .from("customers")
      .select("total_spend, total_visits")
      .eq("id", customerId)
      .single();

    if (fetchError) {
      console.error("Error fetching customer:", fetchError);
      return;
    }

    // Update customer metrics
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        total_spend:
          (parseFloat(customer.total_spend) || 0) + parseFloat(amount),
        total_visits: (customer.total_visits || 0) + 1,
        last_visit_date: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (updateError) {
      console.error("Error updating customer metrics:", updateError);
      return;
    }

    console.log("Customer metrics updated for:", customerId);
  } catch (err) {
    console.error("Error updating customer metrics:", err);
  }
};

/**
 * Start order consumer
 */
const startOrderConsumer = async () => {
  try {
    // Subscribe to order creation channel
    await redisClient.subscribe(channels.ORDER_CREATED, async (message) => {
      try {
        const data = JSON.parse(message);
        await processOrderCreation(data);
      } catch (err) {
        console.error("Error processing order message:", err);
      }
    });

    console.log("Order consumer started");
  } catch (err) {
    console.error("Error starting order consumer:", err);
  }
};

module.exports = { startOrderConsumer };
