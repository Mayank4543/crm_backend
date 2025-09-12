// Segment service
const supabase = require("../config/database");
const customerService = require("./customer.service");

// Create a new segment
const createSegment = async (segmentData, userId) => {
  const segment = {
    ...segmentData,
    created_by: userId,
    audience_size: 0,
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
    await updateSegment(data.id, { audience_size: audienceSize }, userId);
    data.audience_size = audienceSize;
  } catch (err) {
    console.error("Error calculating audience size:", err);
  }

  return data;
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

  return {
    segments: data,
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

// Preview segment audience size
const previewSegmentAudience = async (rules, userId) => {
  return await customerService.countCustomersBySegment(rules);
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
