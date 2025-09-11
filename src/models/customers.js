/**
 * Customers Model
 * Represents the SQL table for customer management
 */

const CREATE_CUSTOMERS_TABLE = `
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  total_spend DECIMAL(10, 2) DEFAULT 0.00,
  total_visits INTEGER DEFAULT 0,
  last_visit_date TIMESTAMP WITH TIME ZONE,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

module.exports = {
  CREATE_CUSTOMERS_TABLE,
};
