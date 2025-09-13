/**
const CREATE_SEGMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rules JSONB NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  audience_size INTEGER DEFAULT 0,
  is_dynamic BOOLEAN DEFAULT true,
  tags TEXT[],
  last_calculated_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_segments_created_by ON segments(created_by);
CREATE INDEX IF NOT EXISTS idx_segments_tags ON segments USING GIN(tags);
`; Model
 * Represents the SQL table for customer segments
 */

const CREATE_SEGMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rules JSONB NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  audience_size INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

module.exports = {
  CREATE_SEGMENTS_TABLE,
};
