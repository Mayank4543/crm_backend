/**
 * Campaigns Model
 * Represents the SQL table for campaign management
 */

const CREATE_CAMPAIGNS_TABLE = `
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  segment_id UUID REFERENCES segments(id) ON DELETE CASCADE,
  message_template TEXT NOT NULL,
  audience_size INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  tags VARCHAR[],
  ai_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

module.exports = {
  CREATE_CAMPAIGNS_TABLE,
};
