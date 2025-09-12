// Order service
const supabase = require("../config/database");
const { publisher, channels } = require("../config/redis");

// Create a new order with user context
const createOrder = async (orderData, userId) => {
  // Add user context to order data
  const orderWithUser = {
    ...orderData,
    userId,
    ref: `ORD-${Date.now()}`,
    status: "PENDING",
  };

  // Publish to Redis for async processing
  await publisher.publish(
    channels.ORDER_CREATED,
    JSON.stringify({
      data: orderWithUser,
      timestamp: new Date().toISOString(),
    })
  );

  return {
    status: "success",
    message: "Order creation queued",
    ref: orderWithUser.ref,
  };
};

// Get orders with pagination for a specific user
const getOrders = async (userId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("orders")
    .select("*, customers(firstName, lastName, email)", { count: "exact" })
    .eq("userId", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error getting orders:", error);
    throw new Error("Failed to get orders");
  }

  return {
    orders: data,
    total: count,
  };
};

// Get order by ID for specific user
const getOrderById = async (id, userId) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, customers(firstName, lastName, email)")
    .eq("id", id)
    .eq("userId", userId)
    .single();

  if (error) {
    console.error("Error getting order:", error);
    return null; // Return null for 404 handling
  }

  return data;
};

// Get all orders
const getAllOrders = async () => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, customers(firstName, lastName, email)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting orders:", error);
    throw new Error("Failed to get orders");
  }

  return data;
};

// Get order by ID (original method for internal use)
const getOrderByIdInternal = async (id) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, customers(firstName, lastName, email)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error getting order:", error);
    throw new Error("Failed to get order");
  }

  return data;
};

// Save order to database (used by consumer)
const saveOrder = async (orderData) => {
  const { data, error } = await supabase
    .from("orders")
    .insert([orderData])
    .select()
    .single();

  if (error) {
    console.error("Error saving order:", error);
    throw new Error("Failed to save order");
  }

  return data;
};

// Get orders by customer ID
const getOrdersByCustomerId = async (customerId) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customerId", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting customer orders:", error);
    throw new Error("Failed to get customer orders");
  }

  return data;
};

// Get customer spending data (for segmentation)
const getCustomerSpendingData = async () => {
  const { data, error } = await supabase
    .from("orders")
    .select("customerId, amount")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting customer spending data:", error);
    throw new Error("Failed to get customer spending data");
  }

  // Aggregate spending by customer
  const spendingByCustomer = {};
  data.forEach((order) => {
    if (!spendingByCustomer[order.customerId]) {
      spendingByCustomer[order.customerId] = 0;
    }
    spendingByCustomer[order.customerId] += order.amount;
  });

  return spendingByCustomer;
};

module.exports = {
  createOrder,
  getOrders,
  getAllOrders,
  getOrderById,
  getOrderByIdInternal,
  saveOrder,
  getOrdersByCustomerId,
  getCustomerSpendingData,
};
