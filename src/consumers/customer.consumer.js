const { subscriber, channels } = require("../config/redis");
const supabase = require("../config/database");

const processCustomerCreation = async (data) => {
  try {
    console.log("Processing customer creation:", data.email);

    const { data: customer, error } = await supabase
      .from("customers")
      .insert([
        {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
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

const startCustomerConsumer = async () => {
  try {
    await subscriber.subscribe(channels.CUSTOMER_CREATED, async (message) => {
      try {
        const { data: customerData } = JSON.parse(message);
        await processCustomerCreation(customerData);
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
