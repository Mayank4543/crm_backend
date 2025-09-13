// Order service
const supabase = require("../config/database");
const { publisher, channels } = require("../config/redis");

// Create a new order
const createOrder = async (orderData) => {
  // Generate order number
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Structure order data for consumer
  const orderForProcessing = {
    customerId: orderData.customerId,
    orderNumber: orderNumber,
    amount: orderData.amount,
    items: orderData.products || orderData.items, // Support both field names
    status: "completed", // Default status
    orderDate: new Date().toISOString(),
  };

  // Publish to Redis for async processing
  await publisher.publish(
    channels.ORDER_CREATED,
    JSON.stringify({
      data: orderForProcessing,
      timestamp: new Date().toISOString(),
    })
  );

  return {
    status: "success",
    message: "Order creation queued",
    ref: orderNumber,
  };
};

// Get orders with pagination
const getOrders = async (page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("orders")
    .select("*, customers(first_name, last_name, email)", { count: "exact" })
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

// Get order by ID
const getOrderById = async (id) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, customers(first_name, last_name, email)")
    .eq("id", id)
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
    .select("*, customers(first_name, last_name, email)")
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
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting customer orders:", error);
    throw new Error("Failed to get customer orders");
  }

  return data;
};

// Delete order by ID
const deleteOrder = async (id) => {
  const { data, error } = await supabase
    .from("orders")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error deleting order:", error);
    throw new Error("Failed to delete order");
  }

  return data;
};

// Update order by ID
const updateOrder = async (id, updateData) => {
  const { data, error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", id)
    .select("*, customers(first_name, last_name, email)")
    .single();

  if (error) {
    console.error("Error updating order:", error);
    throw new Error("Failed to update order");
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
  deleteOrder,
  updateOrder,
};
