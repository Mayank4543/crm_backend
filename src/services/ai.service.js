
let modelPipeline;
let originalConsoleWarn;
let originalStderrWrite;
let originalStdoutWrite;

const supabase = require("../config/database");


let isModelInitialized = false;
let isModelLoading = false;

// Only initialize AI model on demand
async function initializeModelOnDemand() {
  if (isModelInitialized || isModelLoading) {
    return;
  }
  
  isModelLoading = true;
  
  try {
    // Set comprehensive environment variables to suppress ONNX runtime warnings
    process.env.ORT_LOGGING_LEVEL = "4"; // Disable all logging
    process.env.ONNXRUNTIME_LOG_SEVERITY_LEVEL = "4";
    process.env.ORT_LOG_SEVERITY_LEVEL = "4";
    process.env.TENSORFLOWJS_FLAGS = '{"WEBGL_VERSION":2,"WEBGL_CPU_FORWARD":false}';
    
    // Override process.stderr to filter ONNX warnings
    originalStderrWrite = process.stderr.write;
    process.stderr.write = function(chunk, encoding, callback) {
      if (typeof chunk === 'string') {
        // Filter out all ONNX runtime warnings and related messages
        if (chunk.includes('onnxruntime') || 
            chunk.includes('CleanUnusedInitializersAndNodeArgs') ||
            chunk.includes('Removing initializer') ||
            chunk.includes('graph.cc') ||
            chunk.includes('[W:onnxruntime') ||
            chunk.includes('transformer/h.') ||
            chunk.includes('onnx::Unsqueeze') ||
            chunk.includes('Constant_') ||
            chunk.includes('not used by any node')) {
          return true; // Silently ignore
        }
      }
      return originalStderrWrite.call(this, chunk, encoding, callback);
    };
    
    // Override process.stdout to filter ONNX messages
    originalStdoutWrite = process.stdout.write;
    process.stdout.write = function(chunk, encoding, callback) {
      if (typeof chunk === 'string') {
        if (chunk.includes('onnxruntime') || 
            chunk.includes('CleanUnusedInitializersAndNodeArgs') ||
            chunk.includes('Removing initializer')) {
          return true; // Silently ignore
        }
      }
      return originalStdoutWrite.call(this, chunk, encoding, callback);
    };
    
    const { pipeline, env } = await import("@xenova/transformers");
    
    // Configure environment to suppress all ONNX runtime warnings
    env.logLevel = "fatal"; // Only show fatal errors
    env.backends.onnx.logLevel = "fatal";
    env.allowLocalModels = true;
    env.allowRemoteModels = true;
    
    // Comprehensive console warning suppression
    originalConsoleWarn = console.warn;
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    console.warn = function(...args) {
      const message = args.join(' ');
      // Filter out ONNX runtime warnings and related messages
      if (typeof message === 'string' && 
          (message.includes('onnxruntime') || 
           message.includes('CleanUnusedInitializersAndNodeArgs') ||
           message.includes('Removing initializer') ||
           message.includes('graph.cc') ||
           message.includes('[W:onnxruntime') ||
           message.includes('transformer/h.') ||
           message.includes('onnx::Unsqueeze') ||
           message.includes('Constant_') ||
           message.includes('not used by any node'))) {
        return; // Skip ONNX runtime warnings
      }
      originalConsoleWarn.apply(console, args);
    };
    
    // Also suppress specific console.log messages from ONNX
    console.log = function(...args) {
      const message = args.join(' ');
      if (typeof message === 'string' && 
          (message.includes('onnxruntime') || 
           message.includes('CleanUnusedInitializersAndNodeArgs') ||
           message.includes('Removing initializer') ||
           message.includes('onnx::Unsqueeze') ||
           message.includes('Constant_'))) {
        return; // Skip ONNX runtime log messages
      }
      originalConsoleLog.apply(console, args);
    };
    
    // Also suppress console.error messages from ONNX
    console.error = function(...args) {
      const message = args.join(' ');
      if (typeof message === 'string' && 
          (message.includes('onnxruntime') || 
           message.includes('CleanUnusedInitializersAndNodeArgs') ||
           message.includes('Removing initializer'))) {
        return; // Skip ONNX runtime error messages
      }
      originalConsoleError.apply(console, args);
    };
    
    console.log("Loading AI model on demand...");
    
    // Load a lighter model for better performance
    modelPipeline = await pipeline("text-generation", "Xenova/distilgpt2", {
      quantized: true, // Use quantized version for faster loading
      progress_callback: null, // Disable progress logging
      verbose: false, // Disable verbose logging
      silent: true, // Silent loading
    });
    
    isModelInitialized = true;
    console.log("Local AI model loaded successfully.");
  } catch (error) {
    console.error("Failed to load local AI model:", error);
    // Don't exit the process, just disable AI features
    modelPipeline = null;
    isModelInitialized = false;
  } finally {
    isModelLoading = false;
  }
}

// Initialize model immediately (comment out for lazy loading)
// async function initializeModel() {
//   await initializeModelOnDemand();
// }

// Initialize model immediately for better performance
async function initializeModel() {
  console.log("AI service initialized - loading model immediately...");
  await initializeModelOnDemand();
}

function cleanupModel() {
  // Restore original console.warn
  if (originalConsoleWarn) {
    console.warn = originalConsoleWarn;
  }
  
  // Restore original stderr and stdout
  if (originalStderrWrite) {
    process.stderr.write = originalStderrWrite;
  }
  
  if (originalStdoutWrite) {
    process.stdout.write = originalStdoutWrite;
  }
}

// Handle process cleanup
process.on('SIGINT', cleanupModel);
process.on('SIGTERM', cleanupModel);
process.on('exit', cleanupModel);

async function getModel() {
  if (!isModelInitialized && !isModelLoading) {
    await initializeModelOnDemand();
  }
  
  // Wait for model to finish loading if it's currently loading
  while (isModelLoading) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (!modelPipeline) {
    throw new Error("Local AI model failed to initialize or is disabled.");
  }
  
  return modelPipeline;
}

const naturalLanguageToRules = async (naturalLanguage) => {
  try {
    console.log("Converting natural language to rules:", naturalLanguage);

    // Try to use AI model first
    try {
      console.log("Attempting to use AI model...");
      const generator = await getModel();
      
      const prompt = `Convert this natural language query into a JSON object with "operator" and "conditions":
      
Query: "${naturalLanguage}"

Return only a valid JSON object with this structure:
{
  "operator": "AND",
  "conditions": [
    {
      "id": "condition_1",
      "field": "total_spend",
      "operation": "greaterThan",
      "value": 1000
    }
  ]
}

Available fields: total_spend, total_visits, last_visit_date, created_at
Available operations: greaterThan, lessThan, equals, contains
`;

      console.log("Generating response with AI model...");
      const response = await generator(prompt, {
        max_new_tokens: 200,
        do_sample: false,
        temperature: 0.1,
      });

      const generatedText = response[0].generated_text;
      console.log("AI model raw response:", generatedText);
      
      // Extract JSON from response
      const jsonStart = generatedText.indexOf('{');
      const jsonEnd = generatedText.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const jsonString = generatedText.slice(jsonStart, jsonEnd);
        console.log("Extracted JSON:", jsonString);
        
        const aiRules = JSON.parse(jsonString);
        
        // Add IDs if missing and validate structure
        if (aiRules.operator && aiRules.conditions && Array.isArray(aiRules.conditions)) {
          aiRules.conditions = aiRules.conditions.map((condition, index) => ({
            ...condition,
            id: condition.id || `condition_${Date.now()}_${index + 1}`
          }));
          
          console.log("Successfully generated rules using AI model:", JSON.stringify(aiRules, null, 2));
          return aiRules;
        }
      }
      
      throw new Error("Invalid JSON structure from AI model");
      
    } catch (aiError) {
      console.log("AI model failed, falling back to pattern matching:", aiError.message);
      
      // Fallback to pattern matching
      const rules = { operator: "AND", conditions: [] };

      // Parse spending conditions
      if (naturalLanguage.match(/spent\s+(over|more than|above)\s+([₹$])?(\d[\d,.]*)/i)) {
        const match = naturalLanguage.match(/spent\s+(over|more than|above)\s+([₹$])?(\d[\d,.]*)/i);
        const amount = parseFloat(match[3].replace(/,/g, ""));
        rules.conditions.push({
          id: `condition_${Date.now()}_1`,
          field: "total_spend",
          operation: "greaterThan",
          value: amount,
        });
      }

      // Parse visit conditions
      if (naturalLanguage.match(/visit\w*\s+(over|more than|above)\s+(\d+)/i)) {
        const match = naturalLanguage.match(/visit\w*\s+(over|more than|above)\s+(\d+)/i);
        const visits = parseInt(match[2]);
        rules.conditions.push({
          id: `condition_${Date.now()}_2`,
          field: "total_visits",
          operation: "greaterThan",
          value: visits,
        });
      }

      // Parse inactive/haven't visited conditions
      if (naturalLanguage.match(/haven['']?t\s+visited|inactive|not\s+visited.*?(\d+)\s+days/i)) {
        const match = naturalLanguage.match(/(\d+)\s+days/i);
        const days = match ? parseInt(match[1]) : 90;
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - days);
        
        rules.conditions.push({
          id: `condition_${Date.now()}_3`,
          field: "last_visit_date",
          operation: "lessThan",
          value: pastDate.toISOString().split('T')[0],
        });
      }

      // Parse new customer conditions
      if (naturalLanguage.match(/new\s+customer|recent\s+customer|joined.*?(\d+)\s+days/i)) {
        const match = naturalLanguage.match(/(\d+)\s+days/i);
        const days = match ? parseInt(match[1]) : 30;
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - days);
        
        rules.conditions.push({
          id: `condition_${Date.now()}_4`,
          field: "created_at",
          operation: "greaterThan",
          value: pastDate.toISOString().split('T')[0],
        });
      }

      // If no conditions were detected, return a default rule
      if (rules.conditions.length === 0) {
        rules.conditions.push({
          id: `condition_${Date.now()}_default`,
          field: "total_spend",
          operation: "greaterThan",
          value: 0,
        });
      }

      console.log("Generated rules using pattern matching:", JSON.stringify(rules, null, 2));
      return rules;
    }

  } catch (err) {
    console.error("Error converting natural language to rules:", err);
    
    // Return basic fallback rules
    return {
      operator: "AND",
      conditions: [{
        id: `condition_${Date.now()}_fallback`,
        field: "total_spend",
        operation: "greaterThan",
        value: 0,
      }],
    };
  }
};

const generateMessageSuggestions = async (objective, segmentData) => {
  try {
    console.log("Generating message suggestions for objective:", objective);

    // Try to use AI model first
    try {
      console.log("Attempting to use AI model for message suggestions...");
      const generator = await getModel();
      
      const prompt = `Generate 3 marketing message templates for the following campaign objective:

Objective: "${objective}"
Segment Data: ${JSON.stringify(segmentData)}

Generate 3 different message templates that:
1. Use {firstName} as placeholder for personalization
2. Are engaging and relevant to the objective
3. Include a clear call-to-action
4. Are appropriate for the target audience

Return only a JSON array of strings like:
["Message 1", "Message 2", "Message 3"]

Examples:
- For win-back: "Hi {firstName}, we miss you! Come back and enjoy 15% off your next purchase."
- For new product: "Hi {firstName}, check out our newest products - perfect for you!"
- For loyalty: "Thank you for your loyalty, {firstName}! Here's a special 25% off for our top customers."
`;

      console.log("Generating message suggestions with AI model...");
      const response = await generator(prompt, {
        max_new_tokens: 300,
        do_sample: true,
        temperature: 0.7,
      });

      const generatedText = response[0].generated_text;
      console.log("AI model raw response for messages:", generatedText);
      
      // Extract JSON array from response
      const jsonStart = generatedText.indexOf('[');
      const jsonEnd = generatedText.lastIndexOf(']') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const jsonString = generatedText.slice(jsonStart, jsonEnd);
        console.log("Extracted JSON for messages:", jsonString);
        
        const aiMessages = JSON.parse(jsonString);
        
        if (Array.isArray(aiMessages) && aiMessages.length > 0) {
          console.log("Successfully generated messages using AI model:", aiMessages);
          return aiMessages;
        }
      }
      
      throw new Error("Invalid JSON array from AI model");
      
    } catch (aiError) {
      console.log("AI model failed for messages, falling back to templates:", aiError.message);
      
      // Fallback to predefined templates
      const templates = {
        win_back: [
          "Hi {firstName}, we miss you! Come back and enjoy 15% off your next purchase.",
          "Hi {firstName}, it's been a while! Here's a special 20% discount just for you.",
          "{firstName}, we haven't seen you in a while. How about free shipping on your next order?",
        ],
        high_value: [
          "Hi {firstName}, as one of our VIP customers, enjoy early access to our new collection!",
          "Thank you for your loyalty, {firstName}! Here's a special 25% off for our top customers.",
          "Exclusive offer for you, {firstName}! Enjoy premium benefits on your next purchase.",
        ],
        new_product: [
          "Hi {firstName}, check out our newest products - perfect for you based on your past purchases!",
          "{firstName}, we've just launched something we think you'll love. Take a look!",
          "New arrival alert, {firstName}! Based on your taste, we think you'll love our latest collection.",
        ],
        default: [
          "Hi {firstName}, here's 10% off on your next order!",
          "Special offer for you, {firstName}! Save 15% on your next purchase.",
          "Thank you for being our customer, {firstName}! Here's a special offer just for you.",
        ],
      };

      // Determine category based on objective keywords
      let category = "default";
      if (objective.match(/inactive|win back|return|come back/i)) {
        category = "win_back";
      } else if (objective.match(/vip|premium|loyal|high(\s+|-)?value/i)) {
        category = "high_value";
      } else if (objective.match(/new product|launch|release|collection/i)) {
        category = "new_product";
      }

      return templates[category];
    }
  } catch (err) {
    console.error("Error generating message suggestions:", err);

    // Final fallback
    return [
      "Hi {firstName}, here's 10% off on your next order!",
      "Special offer for you, {firstName}! Save 15% on your next purchase.",
      "Thank you for being our customer, {firstName}! Here's a special offer just for you.",
    ];
  }
};

/**
 * Generate campaign performance summary
 * @param {string} campaignId - Campaign ID
 * @returns {string} - Human-readable summary
 */
const generateCampaignSummary = async (campaignId) => {
  try {
    console.log("Generating campaign summary for:", campaignId);

    // Get campaign data
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*, segments(*)")
      .eq("id", campaignId)
      .single();

    if (campaignError) {
      console.error("Error fetching campaign:", campaignError);
      throw new Error("Failed to fetch campaign data");
    }

    // Get delivery statistics
    const { data: logs, error: logsError } = await supabase
      .from("communication_logs")
      .select("status, customers(total_spend)")
      .eq("campaign_id", campaignId);

    if (logsError) {
      console.error("Error fetching logs:", logsError);
      throw new Error("Failed to fetch delivery logs");
    }

    // Fallback summary generation
    const highValueLogs = logs.filter(
      (log) => log.customers?.total_spend > 10000
    );
    const highValueSent = highValueLogs.filter(
      (log) => log.status === "SENT"
    ).length;
    const highValueRate =
      highValueLogs.length > 0
        ? Math.round((highValueSent / highValueLogs.length) * 100)
        : 0;

    return `Your campaign "${campaign.name}" reached ${
      campaign.audience_size
    } users. ${campaign.sent_count} messages were delivered successfully. ${
      campaign.failed_count
    } messages failed to deliver. ${
      highValueLogs.length > 0
        ? `Customers with > ₹10K spend had a ${highValueRate}% delivery rate.`
        : ""
    }`;
  } catch (err) {
    console.error("Error generating campaign summary:", err);
    throw new Error("Failed to generate campaign summary");
  }
};

/**
 * Auto-tag a campaign based on audience and message
 * @param {string} message - Campaign message
 * @param {Object} segmentRules - Segment rules
 * @returns {Array} - List of tags
 */
const autoTagCampaign = async (message, segmentRules) => {
  try {
    console.log("Auto-tagging campaign");

    // Fallback manual tagging
    const tags = [];

    // Check message for common themes
    if (message.match(/discount|% off|save|deal|offer/i)) {
      tags.push("discount");
    }

    if (message.match(/new|launch|introducing|just arrived/i)) {
      tags.push("new-product");
    }

    if (message.match(/limited time|soon|hurry|ends|last chance/i)) {
      tags.push("limited-time");
    }

    if (message.match(/thank you|thanks for|appreciate|grateful/i)) {
      tags.push("appreciation");
    }

    if (message.match(/vip|exclusive|premium|special/i)) {
      tags.push("exclusive");
    }

    // Check segment rules for audience types
    const rulesStr = JSON.stringify(segmentRules);

    if (rulesStr.includes("total_spend") && rulesStr.includes("greaterThan")) {
      tags.push("high-value-customers");
    }

    if (rulesStr.includes("last_visit_date") && rulesStr.includes("lessThan")) {
      tags.push("win-back");
    }

    if (rulesStr.includes("total_visits") && rulesStr.includes("greaterThan")) {
      tags.push("loyal-customers");
    }

    // Return unique tags
    return [...new Set(tags)];
  } catch (err) {
    console.error("Error auto-tagging campaign:", err);
    throw new Error("Failed to auto-tag campaign");
  }
};

/**
 * Suggest the best time to send campaigns
 * @param {string} segmentId - Segment ID to analyze
 * @returns {Object} - Suggested times with confidence scores
 */
const suggestCampaignSchedule = async (segmentId) => {
  try {
    console.log("Generating schedule suggestions for segment:", segmentId);

    // Get customer interaction data for the segment
    const { data: customers, error } = await supabase
      .from("customers")
      .select("last_active_time, active_days")
      .eq("segment_id", segmentId);

    if (error) {
      throw new Error("Failed to fetch customer data");
    }

    // Analyze activity patterns (simplified for demo)
    const activityByHour = new Array(24).fill(0);
    const activityByDay = {
      MONDAY: 0,
      TUESDAY: 0,
      WEDNESDAY: 0,
      THURSDAY: 0,
      FRIDAY: 0,
      SATURDAY: 0,
      SUNDAY: 0,
    };

    // Process customer activity data
    customers.forEach((customer) => {
      if (customer.last_active_time) {
        const date = new Date(customer.last_active_time);
        activityByHour[date.getHours()]++;
      }
      if (customer.active_days) {
        customer.active_days.forEach((day) => {
          activityByDay[day]++;
        });
      }
    });

    // Find best hours (top 3)
    const bestHours = activityByHour
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(({ hour }) => hour);

    // Find best days (top 3)
    const bestDays = Object.entries(activityByDay)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([day]) => day);

    return {
      bestTimes: bestHours.map((hour) => ({
        time: `${hour}:00`,
        confidence: "high",
      })),
      bestDays: bestDays.map((day) => ({
        day,
        confidence: "high",
      })),
      recommendation: `Best time to send: ${bestDays[0]} at ${bestHours[0]}:00`,
    };
  } catch (err) {
    console.error("Error suggesting campaign schedule:", err);
    throw new Error("Failed to generate schedule suggestions");
  }
};

/**
 * Generate lookalike audience based on successful campaign
 * @param {string} campaignId - Source campaign ID
 * @returns {Object} - New segment rules for lookalike audience
 */
const generateLookalikeAudience = async (campaignId) => {
  try {
    console.log("Generating lookalike audience for campaign:", campaignId);

    // Get successful deliveries from the campaign
    const { data: successfulDeliveries, error: deliveryError } = await supabase
      .from("communication_logs")
      .select("customer_id")
      .eq("campaign_id", campaignId)
      .eq("status", "SENT");

    if (deliveryError) {
      throw new Error("Failed to fetch successful deliveries");
    }

    // Get customer profiles for successful deliveries
    const customerIds = successfulDeliveries.map((d) => d.customer_id);
    const { data: customers, error: customerError } = await supabase
      .from("customers")
      .select("total_spend, total_visits, last_visit_date")
      .in("id", customerIds);

    if (customerError) {
      throw new Error("Failed to fetch customer profiles");
    }

    // Analyze customer characteristics
    const avgSpend =
      customers.reduce((sum, c) => sum + (c.total_spend || 0), 0) /
      customers.length;
    const avgVisits =
      customers.reduce((sum, c) => sum + (c.total_visits || 0), 0) /
      customers.length;

    // Generate rules for lookalike audience
    const lookalikeRules = {
      operator: "AND",
      conditions: [
        {
          field: "total_spend",
          operation: "greaterThan",
          value: avgSpend * 0.8, // 80% of average spend
        },
        {
          field: "total_visits",
          operation: "greaterThan",
          value: Math.floor(avgVisits * 0.8), // 80% of average visits
        },
      ],
    };

    return {
      rules: lookalikeRules,
      insights: {
        sourceAudienceSize: customers.length,
        avgSpend: Math.round(avgSpend),
        avgVisits: Math.round(avgVisits),
        recommendation:
          "Targeting similar customers with comparable spending and engagement patterns",
      },
    };
  } catch (err) {
    console.error("Error generating lookalike audience:", err);
    throw new Error("Failed to generate lookalike audience");
  }
};

// Smart scheduling suggestions based on customer activity patterns
const generateSchedulingSuggestions = async (campaignData, segmentRules) => {
  try {
    console.log("Generating smart scheduling suggestions for campaign:", campaignData.objective);

    // Get customer activity patterns for the segment
    const { data: customers, error } = await supabase
      .from("customers")
      .select("last_visit_date, total_visits, created_at")
      .limit(100); // Sample for analysis

    if (error) {
      console.error("Error fetching customer data:", error);
      throw new Error("Failed to fetch customer activity data");
    }

    // Analyze customer activity patterns
    const visitHours = customers.map(customer => {
      if (customer.last_visit_date) {
        return new Date(customer.last_visit_date).getHours();
      }
      return new Date(customer.created_at).getHours();
    });

    // Find peak activity hours
    const hourCounts = {};
    visitHours.forEach(hour => {
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    // Try AI model first
    if (model && tokenizer) {
      try {
        const prompt = `Based on customer activity data, recommend the best time to send a ${campaignData.objective} campaign. Peak activity hours are ${peakHours.join(', ')}. Provide specific day and time recommendations.`;
        
        const inputs = await tokenizer(prompt, { 
          return_tensors: 'pt', 
          max_length: 100,
          truncation: true 
        });
        
        const outputs = await model.generate(inputs.input_ids, {
          max_length: inputs.input_ids.dims[1] + 50,
          num_return_sequences: 1,
          temperature: 0.7,
          do_sample: true,
          pad_token_id: tokenizer.eos_token_id
        });
        
        const response = tokenizer.decode(outputs[0], { skip_special_tokens: true });
        const aiSuggestion = response.substring(prompt.length).trim();
        
        if (aiSuggestion && aiSuggestion.length > 10) {
          return {
            recommendations: [
              {
                day: "Tuesday",
                time: `${peakHours[0]}:00`,
                reason: "Peak customer activity period",
                confidence: 95
              },
              {
                day: "Thursday",
                time: `${peakHours[1]}:00`, 
                reason: "Secondary peak activity",
                confidence: 85
              },
              {
                day: "Saturday",
                time: `${peakHours[2]}:00`,
                reason: "Weekend engagement window",
                confidence: 75
              }
            ],
            aiInsight: aiSuggestion,
            dataSource: "Customer activity analysis"
          };
        }
      } catch (error) {
        console.error("AI scheduling generation error:", error);
      }
    }

    // Fallback recommendations based on general best practices
    const fallbackRecommendations = {
      "increase sales": {
        day: "Tuesday",
        time: "10:00",
        reason: "Highest open rates for promotional content"
      },
      "customer retention": {
        day: "Thursday", 
        time: "14:00",
        reason: "Mid-week engagement peak"
      },
      "re-engagement": {
        day: "Saturday",
        time: "11:00",
        reason: "Weekend leisure browsing time"
      }
    };

    const objective = campaignData.objective?.toLowerCase() || "general";
    const bestMatch = Object.keys(fallbackRecommendations).find(key => 
      objective.includes(key)
    ) || "increase sales";

    const primary = fallbackRecommendations[bestMatch];

    return {
      recommendations: [
        {
          day: primary.day,
          time: primary.time,
          reason: primary.reason,
          confidence: 90
        },
        {
          day: peakHours[0] >= 9 && peakHours[0] <= 17 ? "Wednesday" : "Friday",
          time: `${peakHours[0]}:00`,
          reason: "Based on your customer activity patterns",
          confidence: 80
        },
        {
          day: "Sunday",
          time: "09:00",
          reason: "Weekend planning period",
          confidence: 70
        }
      ],
      dataSource: "Best practices + customer data analysis",
      customerInsights: {
        peakHours: peakHours,
        totalCustomers: customers.length,
        activityPattern: peakHours[0] >= 9 && peakHours[0] <= 17 ? "Business hours" : "After hours"
      }
    };

  } catch (error) {
    console.error("Error generating scheduling suggestions:", error);
    throw new Error("Failed to generate scheduling suggestions");
  }
};

module.exports = {
  initializeModel,
  initializeModelOnDemand,
  cleanupModel,
  naturalLanguageToRules,
  generateMessageSuggestions,
  generateCampaignSummary,
  autoTagCampaign,
  suggestCampaignSchedule,
  generateLookalikeAudience,
  generateSchedulingSuggestions,
};
