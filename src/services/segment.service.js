// Segment service
const supabase = require("../config/database");
const customerService = require("./customer.service");

// Create a new segment
const createSegment = async (segmentData, userId) => {
  const segment = {
    name: segmentData.name,
    description: segmentData.description || null,
    rules: segmentData.rules,
    is_dynamic: segmentData.is_dynamic !== undefined ? segmentData.is_dynamic : true,
    tags: Array.isArray(segmentData.tags) ? segmentData.tags : [],
    created_by: userId,
    audience_size: 0,
    last_calculated_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("segments")
    .insert([segment])
    .select()
    .single();

  if (error) {
    console.error("Error creating segment:", error);
    throw new Error("Failed to create segment");
  }

  // Calculate audience size
  try {
    const audienceSize = await customerService.countCustomersBySegment(
      segmentData.rules
    );
    
    const updatedSegment = await updateSegment(data.id, { 
      audience_size: audienceSize,
      last_calculated_at: new Date().toISOString()
    }, userId);
    
    return updatedSegment || { ...data, audience_size: audienceSize };
  } catch (err) {
    console.error("Error calculating audience size:", err);
    return data;
  }
};

// Get segments with pagination
const getSegments = async (userId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("segments")
    .select("*", { count: "exact" })
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error getting segments:", error);
    throw new Error("Failed to get segments");
  }

  // Add customer counts to each segment
  const segmentsWithCounts = await Promise.all(
    data.map(async (segment) => {
      try {
        const customerCount = await customerService.countCustomersBySegment(
          segment.rules
        );
        return {
          ...segment,
          customer_count: customerCount,
        };
      } catch (err) {
        console.error(
          `Error counting customers for segment ${segment.id}:`,
          err
        );
        return {
          ...segment,
          customer_count: segment.audience_size || 0,
        };
      }
    })
  );

  return {
    segments: segmentsWithCounts,
    total: count,
  };
};

// Get all segments for a user
const getAllSegments = async (userId) => {
  const { data, error } = await supabase
    .from("segments")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting segments:", error);
    throw new Error("Failed to get segments");
  }

  return data;
};

// Get segment by ID for specific user
const getSegmentById = async (id, userId) => {
  const { data, error } = await supabase
    .from("segments")
    .select("*")
    .eq("id", id)
    .eq("created_by", userId)
    .single();

  if (error) {
    console.error("Error getting segment:", error);
    return null;
  }

  return data;
};

// Update segment
const updateSegment = async (id, updateData, userId) => {
  const segment = {
    ...updateData,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("segments")
    .update(segment)
    .eq("id", id)
    .eq("created_by", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating segment:", error);
    return null;
  }

  return data;
};

// Delete segment
const deleteSegment = async (id, userId) => {
  const { data, error } = await supabase
    .from("segments")
    .delete()
    .eq("id", id)
    .eq("created_by", userId)
    .select()
    .single();

  if (error) {
    console.error("Error deleting segment:", error);
    return null;
  }

  return data;
};

// Preview segment audience with detailed data
const previewSegmentAudience = async (rules, userId) => {
  try {
    console.log('Previewing segment audience with rules:', JSON.stringify(rules, null, 2));
    
    const customers = await customerService.findCustomersBySegment(rules);
    
    console.log(`Preview found ${customers.length} customers`);

    return {
      total: customers.length,
      count: customers.length,
      sample: customers.slice(0, 5).map((customer) => ({
        id: customer.id,
        name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        email: customer.email,
        phone: customer.phone,
        first_name: customer.first_name,
        last_name: customer.last_name,
        total_spend: customer.total_spend,
        total_visits: customer.total_visits,
        created_at: customer.created_at,
      })),
    };
  } catch (error) {
    console.error('Error in previewSegmentAudience:', error);
    throw error;
  }
};

// Refresh audience size for a segment
const refreshAudienceSize = async (segmentId, userId) => {
  const segment = await getSegmentById(segmentId, userId);

  if (!segment) {
    throw new Error("Segment not found");
  }

  const audienceSize = await customerService.countCustomersBySegment(
    segment.rules
  );

  await updateSegment(segmentId, { audience_size: audienceSize }, userId);

  return audienceSize;
};

module.exports = {
  createSegment,
  getSegments,
  getAllSegments,
  getSegmentById,
  updateSegment,
  deleteSegment,
  previewSegmentAudience,
  refreshAudienceSize,
};
