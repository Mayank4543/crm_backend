/**
 * Supabase SQL Functions
 * These functions help with database operations
 */

const supabase = require("../config/database");

/**
 * Create a stored procedure to execute arbitrary SQL
 * This allows us to run CREATE TABLE statements from the client
 */
const createStoredProcedures = async () => {
  try {
    // Create extension for UUID if it doesn't exist
    const createUuidExtension = `
      CREATE OR REPLACE FUNCTION create_uuid_extension()
      RETURNS void AS $$
      BEGIN
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // Create function to execute DDL statements
    const createTableFunction = `
      CREATE OR REPLACE FUNCTION create_table(query text)
      RETURNS void AS $$
      BEGIN
        EXECUTE query;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // Execute stored procedure creation
    await supabase
      .rpc("exec_sql", { sql: createUuidExtension })
      .catch(() => console.log("Creating UUID extension function..."));

    await supabase
      .rpc("exec_sql", { sql: createTableFunction })
      .catch(() => console.log("Creating table function..."));

    console.log("Stored procedures created or already exist");
  } catch (err) {
    // First-time setup, create the exec_sql function
    const createExecSql = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    try {
      // Use raw REST API to create the initial function
      const url = `${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
        body: JSON.stringify({ sql: createExecSql }),
      });

      if (response.ok) {
        console.log("Initial exec_sql function created");
        // Now recursively call to create the other functions
        await createStoredProcedures();
      } else {
        console.error(
          "Failed to create initial exec_sql function:",
          await response.text()
        );
      }
    } catch (error) {
      console.error("Error setting up stored procedures:", error);
    }
  }
};

module.exports = { createStoredProcedures };
