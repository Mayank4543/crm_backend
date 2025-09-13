// Customer service
const supabase = require("../config/database");

// Try to import Redis, but handle gracefully if not available
let publisher = null;
let channels = null;

try {
  const redis = require("../config/redis");
  publisher = redis.publisher;
  channels = redis.channels;
  console.log('Redis configuration loaded successfully');
} catch (error) {
  console.warn('Redis not available, customer creation will work without Redis:', error.message);
}

// Create a new customer with user context
const createCustomer = async (customerData, userId = null) => {
  try {
    console.log('Creating customer with data:', JSON.stringify(customerData, null, 2));
    
    // For better user experience, let's save to database immediately
    // and also publish to Redis for any additional processing
    const customer = {
      email: customerData.email,
      first_name: customerData.first_name,
      last_name: customerData.last_name,
      phone: customerData.phone || null,
      address: customerData.address || null,
      total_spend: parseFloat(customerData.total_spend) || 0,
      total_visits: parseInt(customerData.total_visits) || 0,
      last_visit_date: customerData.last_visit_date || null,
      tags: Array.isArray(customerData.tags) ? customerData.tags : [],
    };

    console.log('Processed customer data:', JSON.stringify(customer, null, 2));

    // Save directly to database for immediate response
    const savedCustomer = await saveCustomer(customer);

    // Also publish to Redis for any additional async processing (but don't fail if Redis fails)
    if (publisher && channels) {
      try {
        await publisher.publish(
          channels.CUSTOMER_CREATED,
          JSON.stringify({
            data: savedCustomer,
            timestamp: new Date().toISOString(),
          })
        );
        console.log('Successfully published to Redis');
      } catch (redisError) {
        console.warn('Redis publish failed (non-critical):', redisError.message);
        // Don't fail the customer creation if Redis fails
      }
    } else {
      console.log('Redis not available, skipping event publishing');
    }

    return { 
      status: "success", 
      message: "Customer created successfully",
      data: savedCustomer 
    };
  } catch (error) {
    console.error("Error creating customer:", error);
    throw new Error("Failed to create customer: " + error.message);
  }
};

// Get customers with pagination
const getCustomers = async (page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error getting customers:", error);
    throw new Error("Failed to get customers");
  }

  return {
    customers: data,
    total: count,
  };
};

// Get all customers
const getAllCustomers = async () => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting customers:", error);
    throw new Error("Failed to get customers");
  }

  return data;
};

// Get customer by ID
const getCustomerById = async (id) => {
  let query = supabase.from("customers").select("*").eq("id", id);

  // Remove user filtering since customers table doesn't have created_by
  // if (userId) {
  //   query = query.eq('created_by', userId);
  // }

  const { data, error } = await query.single();

  if (error) {
    console.error("Error getting customer:", error);
    return null; // Return null instead of throwing for 404 handling
  }

  return data;
};

// Save customer to database (used by consumer)
const saveCustomer = async (customerData) => {
  try {
    console.log('Attempting to save customer:', JSON.stringify(customerData, null, 2));
    
    const { data, error } = await supabase
      .from("customers")
      .insert([customerData])
      .select()
      .single();

    if (error) {
      console.error("Supabase error saving customer:", error);
      console.error("Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to save customer: ${error.message}`);
    }

    console.log('Customer saved successfully:', data);
    return data;
  } catch (error) {
    console.error("Unexpected error saving customer:", error);
    if (error.message && error.message.includes('Failed to save customer:')) {
      throw error; // Re-throw our custom error
    }
    throw new Error(`Failed to save customer: ${error.message}`);
  }
};

// Find customers by segment rules
const findCustomersBySegment = async (rules) => {
  try {
    console.log('Finding customers by segment rules:', JSON.stringify(rules, null, 2));

    let query = supabase.from("customers").select("*");

    // Handle the rules structure
    if (rules && rules.conditions && Array.isArray(rules.conditions)) {
      // For now, we'll apply all conditions with AND logic
      // TODO: Implement proper AND/OR logic handling
      
      for (const condition of rules.conditions) {
        console.log('Applying condition:', condition);
        
        // Handle different operators
        switch (condition.operator) {
          case "=":
          case "equals":
            query = query.eq(condition.field, condition.value);
            break;
          case "!=":
          case "notEquals":
            query = query.neq(condition.field, condition.value);
            break;
          case ">":
          case "greaterThan":
            query = query.gt(condition.field, condition.value);
            break;
          case "<":
          case "lessThan":
            query = query.lt(condition.field, condition.value);
            break;
          case ">=":
          case "greaterThanOrEqual":
            query = query.gte(condition.field, condition.value);
            break;
          case "<=":
          case "lessThanOrEqual":
            query = query.lte(condition.field, condition.value);
            break;
          case "contains":
            if (condition.field === 'tags') {
              // For array fields like tags, use contains
              query = query.contains('tags', [condition.value]);
            } else {
              // For text fields, use ilike for case-insensitive search
              query = query.ilike(condition.field, `%${condition.value}%`);
            }
            break;
          case "not_contains":
            if (condition.field === 'tags') {
              // For array fields, this is more complex - skip for now
              console.warn('not_contains for tags not implemented yet');
            } else {
              query = query.not('ilike', condition.field, `%${condition.value}%`);
            }
            break;
          case "starts_with":
            query = query.ilike(condition.field, `${condition.value}%`);
            break;
          case "ends_with":
            query = query.ilike(condition.field, `%${condition.value}`);
            break;
          case "between":
            if (Array.isArray(condition.value) && condition.value.length === 2) {
              query = query.gte(condition.field, condition.value[0]).lte(condition.field, condition.value[1]);
            }
            break;
          default:
            console.warn(`Unsupported operator: ${condition.operator}`);
            break;
        }
      }
    } else {
      console.log('No valid conditions found, returning all customers');
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error finding customers by segment:", error);
      throw new Error("Failed to find customers by segment: " + error.message);
    }

    console.log(`Found ${data ? data.length : 0} customers matching segment rules`);
    return data || [];
  } catch (error) {
    console.error("Error in findCustomersBySegment:", error);
    throw new Error("Failed to find customers by segment: " + error.message);
  }
};

// Update existing customer
const updateCustomer = async (id, customerData, userId = null) => {
  try {
    const customer = {
      email: customerData.email,
      first_name: customerData.first_name,
      last_name: customerData.last_name,
      phone: customerData.phone || null,
      address: customerData.address || null,
      total_spend: parseFloat(customerData.total_spend) || 0,
      total_visits: parseInt(customerData.total_visits) || 0,
      last_visit_date: customerData.last_visit_date || null,
      tags: Array.isArray(customerData.tags) ? customerData.tags : [],
    };

    console.log('Updating customer with ID:', id, 'Data:', customer);

    const { data, error } = await supabase
      .from("customers")
      .update(customer)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating customer:", error);
      throw new Error("Failed to update customer: " + error.message);
    }

    // Publish update event to Redis
    await publisher.publish(
      channels.CUSTOMER_UPDATED,
      JSON.stringify({
        data,
        timestamp: new Date().toISOString(),
      })
    );

    return { 
      status: "success", 
      message: "Customer updated successfully",
      data 
    };
  } catch (error) {
    console.error("Error updating customer:", error);
    throw new Error("Failed to update customer: " + error.message);
  }
};

// Delete customer
const deleteCustomer = async (id, userId = null) => {
  try {
    console.log('Deleting customer with ID:', id);

    // First get the customer data for the event
    const customerToDelete = await getCustomerById(id);
    if (!customerToDelete) {
      throw new Error("Customer not found");
    }

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting customer:", error);
      throw new Error("Failed to delete customer: " + error.message);
    }

    // Publish delete event to Redis
    await publisher.publish(
      channels.CUSTOMER_DELETED,
      JSON.stringify({
        data: customerToDelete,
        timestamp: new Date().toISOString(),
      })
    );

    return { 
      status: "success", 
      message: "Customer deleted successfully"
    };
  } catch (error) {
    console.error("Error deleting customer:", error);
    throw new Error("Failed to delete customer: " + error.message);
  }
};

// Count customers by segment rules
const countCustomersBySegment = async (rules) => {
  const customers = await findCustomersBySegment(rules);
  return customers.length;
};

module.exports = {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomers,
  getAllCustomers,
  getCustomerById,
  saveCustomer,
  findCustomersBySegment,
  countCustomersBySegment,
};
