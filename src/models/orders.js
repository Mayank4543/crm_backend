/**
 * Orders Model
 * Represents the SQL table for order management
 */

const CREATE_ORDERS_TABLE = `
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  items JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

module.exports = {
  CREATE_ORDERS_TABLE,
};
