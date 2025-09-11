// Customer service
const supabase = require('../config/database');
const { redisClient, channels } = require('../config/redis');

// Create a new customer with user context
const createCustomer = async (customerData, userId = null) => {
  const customer = {
    ...customerData,
    created_by: userId, // Optional user context
    created_at: new Date().toISOString()
  };
  
  // Publish to Redis for async processing
  await redisClient.publish(
    channels.CUSTOMER_CREATED,
    JSON.stringify({
      data: customer,
      timestamp: new Date().toISOString()
    })
  );

  return { status: 'success', message: 'Customer creation queued' };
};

// Get customers with pagination
const getCustomers = async (userId = null, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  
  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // If userId is provided, filter by user (optional for now)
  // if (userId) {
  //   query = query.eq('created_by', userId);
  // }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error getting customers:', error);
    throw new Error('Failed to get customers');
  }

  return {
    customers: data,
    total: count
  };
};

// Get all customers
const getAllCustomers = async () => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting customers:', error);
    throw new Error('Failed to get customers');
  }

  return data;
};

// Get customer by ID with optional user context
const getCustomerById = async (id, userId = null) => {
  let query = supabase
    .from('customers')
    .select('*')
    .eq('id', id);

  // If userId is provided, filter by user (optional for now)
  // if (userId) {
  //   query = query.eq('created_by', userId);
  // }

  const { data, error } = await query.single();

  if (error) {
    console.error('Error getting customer:', error);
    return null; // Return null instead of throwing for 404 handling
  }

  return data;
};

// Save customer to database (used by consumer)
const saveCustomer = async (customerData) => {
  const { data, error } = await supabase
    .from('customers')
    .insert([customerData])
    .select()
    .single();

  if (error) {
    console.error('Error saving customer:', error);
    throw new Error('Failed to save customer');
  }

  return data;
};

// Find customers by segment rules
const findCustomersBySegment = async (rules) => {
  // Convert rules to SQL query (simplified for now)
  // In a real app, you'd need to build more complex queries based on the rule structure
  
  let query = supabase.from('customers').select('*');
  
  // Parse and apply the rules
  // This is a simplified implementation that handles basic conditions
  if (rules.conditions && Array.isArray(rules.conditions)) {
    rules.conditions.forEach(condition => {
      // Handle basic comparison operators
      switch (condition.operator) {
        case 'equals':
          query = query.eq(condition.field, condition.value);
          break;
        case 'notEquals':
          query = query.neq(condition.field, condition.value);
          break;
        case 'greaterThan':
          query = query.gt(condition.field, condition.value);
          break;
        case 'lessThan':
          query = query.lt(condition.field, condition.value);
          break;
        case 'contains':
          query = query.ilike(condition.field, `%${condition.value}%`);
          break;
        default:
          // Ignore unsupported operators
          break;
      }
    });
  }
  
  // For advanced segmentation, you might need to use raw SQL queries
  // or build a more sophisticated query builder
  
  const { data, error } = await query;

  if (error) {
    console.error('Error finding customers by segment:', error);
    throw new Error('Failed to find customers by segment');
  }

  return data;
};

// Count customers by segment rules
const countCustomersBySegment = async (rules) => {
  const customers = await findCustomersBySegment(rules);
  return customers.length;
};

module.exports = {
  createCustomer,
  getCustomers,
  getAllCustomers,
  getCustomerById,
  saveCustomer,
  findCustomersBySegment,
  countCustomersBySegment
};
