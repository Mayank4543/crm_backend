/**
 * Database Initialization Script
 * This script verifies database tables exist in Supabase
 */

const supabase = require("../config/database");

/**
 * Verify database tables exist
 * Instead of creating tables, we'll just check if they exist
 */
const initializeDatabase = async () => {
  try {
    console.log("Starting database verification...");

    // List of expected tables
    const expectedTables = [
      "users",
      "customers",
      "orders",
      "segments",
      "campaigns",
      "communication_logs",
    ];

    // Check if tables exist by trying to query them
    for (const tableName of expectedTables) {
      try {
        const { error } = await supabase.from(tableName).select("id").limit(1);

        if (error) {
          console.warn(`Table ${tableName} might not exist:`, error.message);
        } else {
          console.log(`✅ ${tableName} table verified`);
        }
      } catch (err) {
        console.warn(`⚠️  Could not verify ${tableName} table:`, err.message);
      }
    }

    console.log("Database verification completed");
    console.log(
      "If any tables are missing, please run the SQL script in Supabase dashboard"
    );
  } catch (err) {
    console.error("Database verification failed:", err);
  }
};

module.exports = { initializeDatabase };
