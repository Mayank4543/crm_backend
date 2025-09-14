/**
 * AI Service for CRM Campaign Management
 * 
 * This service provides AI-powered features for customer segmentation,
 * message generation, lookalike audience creation, and campaign optimization.
 * 
 * Features:
 * - Natural language to database rules conversion
 * - Intelligent message template generation
 * - Lookalike audience analysis
 * - Campaign performance insights
 * 
 * @author CRM Development Team
 * @version 2.0.0
 */

const { pipeline } = require("@xenova/transformers");
const { supabase } = require("../config/database");

// =============================================================================
// AI MODEL MANAGEMENT
// =============================================================================

class AIModelManager {
  constructor() {
    this.modelPipeline = null;
    this.isModelLoading = false;
    this.isModelInitialized = false;
    this.originalConsoleWarn = null;
    this.originalStderrWrite = null;
    this.originalStdoutWrite = null;
  }

  /**
   * Mute console noise during model loading
   * @private
   */
  muteConsoleNoise() {
    // Store original functions
    this.originalConsoleWarn = console.warn;
    this.originalStderrWrite = process.stderr.write;
    this.originalStdoutWrite = process.stdout.write;

    // Filter out specific warnings
    console.warn = (...args) => {
      const message = args.join(' ');
      
      // Skip specific model-related warnings
      if (
        message.includes('token_type_ids') ||
        message.includes('model.safetensors') ||
        message.includes('Using sep_token') ||
        message.includes('Using pad_token') ||
        message.includes('Using cls_token') ||
        message.includes('Loading model from') ||
        message.includes('Cannot find model.json') ||
        message.includes('transformers') ||
        message.includes('onnx') ||
        message.includes('decoder') ||
        message.includes('encoder') ||
        message.includes('generation_config')
      ) {
        return; // Skip these warnings
      }
      
      // Call original for other warnings
      this.originalConsoleWarn.apply(console, args);
    };

    // Filter stderr output
    process.stderr.write = (chunk, ...args) => {
      const message = chunk.toString();
      
      // Skip model loading messages
      if (
        message.includes('[INFO]') ||
        message.includes('[WARN]') ||
        message.includes('model.safetensors') ||
        message.includes('transformers') ||
        message.includes('onnx') ||
        message.includes('Loading') ||
        message.includes('Downloading')
      ) {
        return true; // Skip these
      }
      
      return this.originalStderrWrite.call(this, chunk, ...args);
    };

    // Keep stdout mostly unchanged but filter some noisy messages
    process.stdout.write = (chunk, ...args) => {
      const message = chunk.toString();
      
      if (
        message.includes('Downloading') ||
        message.includes('Loading model')
      ) {
        return true; // Skip downloading messages
      }
      
      return this.originalStdoutWrite.call(this, chunk, ...args);
    };
  }

  /**
   * Initialize AI model on demand
   * @returns {Promise<void>}
   */
  async initializeModel() {
    if (this.isModelInitialized || this.isModelLoading) {
      return;
    }

    this.isModelLoading = true;
    console.log("Loading AI model for enhanced text generation...");

    // Mute console noise during model loading
    this.muteConsoleNoise();

    try {
      // Load a lighter model for better performance
      this.modelPipeline = await pipeline("text-generation", "Xenova/distilgpt2", {
        quantized: true, // Use quantized version for faster loading
        progress_callback: null, // Disable progress logging
        verbose: false, // Disable verbose logging
        silent: true, // Silent loading
      });
      
      this.isModelInitialized = true;
      console.log("AI model loaded successfully.");
    } catch (error) {
      console.error("Failed to load AI model:", error);
      // Don't exit the process, just disable AI features
      this.modelPipeline = null;
      this.isModelInitialized = false;
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Get the AI model instance
   * @returns {Promise<Object>} AI model pipeline
   */
  async getModel() {
    if (!this.isModelInitialized && !this.isModelLoading) {
      await this.initializeModel();
    }
    
    // Wait for model to finish loading if it's currently loading
    while (this.isModelLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.modelPipeline) {
      throw new Error("AI model failed to initialize or is disabled.");
    }
    
    return this.modelPipeline;
  }

  /**
   * Cleanup model resources
   */
  cleanup() {
    // Restore original console.warn
    if (this.originalConsoleWarn) {
      console.warn = this.originalConsoleWarn;
    }
    
    // Restore original stderr and stdout
    if (this.originalStderrWrite) {
      process.stderr.write = this.originalStderrWrite;
    }
    
    if (this.originalStdoutWrite) {
      process.stdout.write = this.originalStdoutWrite;
    }
  }
}

// Global AI model manager instance
const aiModelManager = new AIModelManager();

// =============================================================================
// NATURAL LANGUAGE PROCESSING
// =============================================================================

class NaturalLanguageProcessor {
  /**
   * Generate unique condition ID
   * @returns {string} Unique condition ID
   */
  static generateConditionId() {
    return `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enhanced pattern matching for natural language rules
   * @param {string} text - Natural language text
   * @returns {Object} Database query rules
   */
  static enhancedPatternMatching(text) {
    const rules = { operator: "AND", conditions: [] };
    const conditionId = this.generateConditionId;

    // Multiple spending patterns with currency support
    const spendingPatterns = [
      { 
        pattern: /spent\s+(?:over|more\s+than|above|>\s*)\s*[₹$]?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:rupees?|rs?\.?|dollars?|\$)?/i, 
        operator: 'greaterThan' 
      },
      { 
        pattern: /spent\s+(?:under|less\s+than|below|<\s*)\s*[₹$]?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:rupees?|rs?\.?|dollars?|\$)?/i, 
        operator: 'lessThan' 
      },
      { 
        pattern: /spent\s+(?:exactly|equal\s+to|=\s*)\s*[₹$]?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:rupees?|rs?\.?|dollars?|\$)?/i, 
        operator: 'equals' 
      },
      { 
        pattern: /spent\s+between\s+[₹$]?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:and|to|\-)\s+[₹$]?(\d+(?:,\d{3})*(?:\.\d{2})?)/i, 
        operator: 'between' 
      }
    ];

    spendingPatterns.forEach(({ pattern, operator }) => {
      const match = text.match(pattern);
      if (match) {
        if (operator === 'between' && match[2]) {
          const min = parseFloat(match[1].replace(/,/g, ''));
          const max = parseFloat(match[2].replace(/,/g, ''));
          rules.conditions.push({
            id: conditionId(),
            field: "total_spend",
            operation: "between",
            value: [min, max],
          });
        } else {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          rules.conditions.push({
            id: conditionId(),
            field: "total_spend",
            operation: operator,
            value: amount,
          });
        }
      }
    });

    // Visit patterns with various phrasings
    const visitPatterns = [
      { pattern: /(?:visit|visited|visits)\s+(?:over|more\s+than|above|>\s*)(\d+)\s*(?:times?)?/i, operator: 'greaterThan' },
      { pattern: /(?:visit|visited|visits)\s+(?:under|less\s+than|below|<\s*)(\d+)\s*(?:times?)?/i, operator: 'lessThan' },
      { pattern: /(?:visit|visited|visits)\s+(?:exactly|equal\s+to|=\s*)(\d+)\s*(?:times?)?/i, operator: 'equals' },
      { pattern: /frequent\s+(?:customer|visitor|shopper)s?/i, operator: 'greaterThan', defaultValue: 5 },
      { pattern: /regular\s+(?:customer|visitor|shopper)s?/i, operator: 'greaterThan', defaultValue: 3 },
      { pattern: /occasional\s+(?:customer|visitor|shopper)s?/i, operator: 'between', defaultValue: [1, 3] },
      { pattern: /first[\s\-]?time\s+(?:customer|visitor|buyer)s?/i, operator: 'equals', defaultValue: 1 },
      { pattern: /new\s+(?:customer|visitor|shopper)s?/i, operator: 'lessThan', defaultValue: 3 }
    ];

    visitPatterns.forEach(({ pattern, operator, defaultValue }) => {
      const match = text.match(pattern);
      if (match) {
        const value = match[1] ? parseInt(match[1]) : defaultValue;
        rules.conditions.push({
          id: conditionId(),
          field: "total_visits",
          operation: operator,
          value: value,
        });
      }
    });

    // Enhanced time-based patterns
    const timePatterns = [
      { 
        pattern: /(?:haven['']?t\s+(?:visited|shopped|bought)|inactive|not\s+(?:visited|active)).*?(?:in\s+(?:the\s+)?(?:last|past)\s+)?(\d+)\s+(day|week|month)s?/i, 
        field: 'last_visit_date', 
        operator: 'isNotInLast' 
      },
      { 
        pattern: /(?:new\s+customer|recent\s+customer|recently\s+joined|joined).*?(?:in\s+(?:the\s+)?(?:last|past)\s+)?(\d+)\s+(day|week|month)s?/i, 
        field: 'created_at', 
        operator: 'isInLast' 
      },
      { 
        pattern: /(?:visited|active|shopped).*?(?:in\s+(?:the\s+)?(?:last|past)\s+)?(\d+)\s+(day|week|month)s?/i, 
        field: 'last_visit_date', 
        operator: 'isInLast' 
      },
      {
        pattern: /high[\s\-]?value\s+(?:customer|client)s?/i,
        field: 'total_spend',
        operator: 'greaterThan',
        defaultValue: 10000
      },
      {
        pattern: /loyal\s+(?:customer|client)s?/i,
        field: 'total_visits',
        operator: 'greaterThan',
        defaultValue: 5
      },
      {
        pattern: /inactive\s+(?:customer|client)s?/i,
        field: 'last_visit_date',
        operator: 'isNotInLast',
        defaultValue: 90,
        defaultUnit: 'days'
      },
      {
        pattern: /(?:premium|vip)\s+(?:customer|client)s?/i,
        field: 'total_spend',
        operator: 'greaterThan',
        defaultValue: 25000
      }
    ];

    timePatterns.forEach(({ pattern, field, operator, defaultValue, defaultUnit }) => {
      const match = text.match(pattern);
      if (match) {
        if (match[1] && match[2]) {
          const value = parseInt(match[1]);
          const unit = match[2].toLowerCase() + 's'; // Convert to plural
          rules.conditions.push({
            id: conditionId(),
            field: field,
            operation: operator,
            value: value,
            unit: unit
          });
        } else if (defaultValue !== undefined) {
          const condition = {
            id: conditionId(),
            field: field,
            operation: operator,
            value: defaultValue,
          };
          if (defaultUnit) {
            condition.unit = defaultUnit;
          }
          rules.conditions.push(condition);
        }
      }
    });

    // Enhanced location patterns
    const locationPatterns = [
      /(?:from|in|located|lives?\s+in|based\s+in)\s+([a-zA-Z\s]+?)(?:\s|$)/i,
      /(?:city|state|country):\s*([a-zA-Z\s]+)/i,
      /address.*?(?:contains|includes|has)\s+([a-zA-Z\s]+)/i
    ];

    locationPatterns.forEach(pattern => {
      const match = text.match(pattern);
      if (match) {
        const location = match[1].trim();
        if (location.length > 2) {
          rules.conditions.push({
            id: conditionId(),
            field: "address",
            operation: "contains",
            value: location,
          });
        }
      }
    });

    // Enhanced tag patterns
    const tagPatterns = [
      /(?:tagged\s+(?:as|with)|has\s+tag|labeled\s+as)\s+([a-zA-Z\s]+)/i,
      /(?:category|type|segment):\s*([a-zA-Z\s]+)/i,
      /belongs\s+to\s+([a-zA-Z\s]+)/i
    ];

    tagPatterns.forEach(pattern => {
      const match = text.match(pattern);
      if (match) {
        const tag = match[1].trim();
        if (tag.length > 2) {
          rules.conditions.push({
            id: conditionId(),
            field: "tags",
            operation: "contains",
            value: tag,
          });
        }
      }
    });

    // Enhanced email patterns
    const emailPatterns = [
      { pattern: /email\s+(?:contains|includes|has)\s+([a-zA-Z0-9@.]+)/i, operator: 'contains' },
      { pattern: /email\s+(?:ends\s+with|domain)\s+([a-zA-Z0-9@.]+)/i, operator: 'endsWith' },
      { pattern: /email\s+(?:starts\s+with|begins\s+with)\s+([a-zA-Z0-9@.]+)/i, operator: 'startsWith' },
      { pattern: /(?:gmail|yahoo|hotmail|outlook)\s+users?/i, operator: 'contains', defaultValue: '$1' }
    ];

    emailPatterns.forEach(({ pattern, operator, defaultValue }) => {
      const match = text.match(pattern);
      if (match) {
        const value = defaultValue ? match[0].split(' ')[0] + '.com' : match[1];
        rules.conditions.push({
          id: conditionId(),
          field: "email",
          operation: operator,
          value: value,
        });
      }
    });

    return rules;
  }

  /**
   * Extract JSON from AI response text
   * @param {string} text - AI response text
   * @returns {Object|null} Parsed JSON object or null
   */
  static extractJSON(text) {
    // Try to find JSON object
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const jsonString = text.slice(jsonStart, jsonEnd);
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        console.log("Failed to parse JSON:", e.message);
        return null;
      }
    }
    return null;
  }
}

// =============================================================================
// MESSAGE GENERATION
// =============================================================================

class MessageGenerator {
  /**
   * Message categories with templates and defaults
   */
  static MESSAGE_CATEGORIES = {
    welcome: {
      templates: [
        "🎉 Welcome to our family! Get {discount}% off your first purchase with code WELCOME{discount}",
        "👋 Hi there! Thanks for joining us. Here's a special {discount}% discount just for you!",
        "✨ Welcome aboard! Start your journey with us and save {discount}% on your first order"
      ],
      defaults: { discount: 10 }
    },
    promotional: {
      templates: [
        "🔥 Limited Time: {discount}% OFF everything! Don't miss out - shop now!",
        "💰 Flash Sale Alert! Save {discount}% on all items. Valid for {hours} hours only!",
        "🛍️ Special Offer: Get {discount}% discount on your favorite products today!"
      ],
      defaults: { discount: 20, hours: 24 }
    },
    win_back: {
      templates: [
        "💝 We miss you! Come back and enjoy {discount}% off your next purchase",
        "🔄 Ready to return? Here's {discount}% off to welcome you back!",
        "✨ Your favorite items are waiting! Return with {discount}% discount"
      ],
      defaults: { discount: 15 }
    },
    high_value: {
      templates: [
        "👑 VIP Exclusive: Special {discount}% discount for our valued customers like you",
        "💎 Premium Member Perk: Enjoy {discount}% off your next luxury purchase",
        "🌟 Elite Customer Reward: {discount}% discount on premium collection"
      ],
      defaults: { discount: 25 }
    },
    new_product: {
      templates: [
        "🚀 New Arrival Alert! Be first to try our latest products with {discount}% off",
        "✨ Fresh & New! Discover our latest collection with early bird {discount}% discount",
        "🎯 Just Launched! Get exclusive {discount}% off on our newest products"
      ],
      defaults: { discount: 15 }
    },
    seasonal: {
      templates: [
        "🎄 Season's Greetings! Celebrate with {discount}% off everything",
        "🌸 Spring Into Savings! Enjoy {discount}% discount on seasonal favorites",
        "☀️ Summer Sale Spectacular! Beat the heat with {discount}% off"
      ],
      defaults: { discount: 30 }
    },
    loyalty: {
      templates: [
        "🙏 Thank you for your loyalty! Here's {discount}% off as our appreciation",
        "💝 Loyal Customer Reward: Enjoy exclusive {discount}% discount",
        "⭐ Your loyalty deserves rewards! Get {discount}% off your next order"
      ],
      defaults: { discount: 20 }
    },
    urgent: {
      templates: [
        "⚡ Last Chance! Only {hours} hours left to get {discount}% off",
        "🚨 Final Call! Don't miss {discount}% discount - expires in {hours} hours",
        "⏰ Almost Gone! Grab {discount}% off before it's too late"
      ],
      defaults: { discount: 25, hours: 12 }
    }
  };

  /**
   * Determine message category based on campaign objective
   * @param {string} objective - Campaign objective
   * @returns {string} Message category
   */
  static determineCategory(objective) {
    const objLower = objective.toLowerCase();
    
    if (objLower.includes('welcome') || objLower.includes('new customer')) return 'welcome';
    if (objLower.includes('win back') || objLower.includes('inactive') || objLower.includes('return')) return 'win_back';
    if (objLower.includes('high value') || objLower.includes('premium') || objLower.includes('vip')) return 'high_value';
    if (objLower.includes('new product') || objLower.includes('launch') || objLower.includes('arrival')) return 'new_product';
    if (objLower.includes('season') || objLower.includes('holiday') || objLower.includes('festival')) return 'seasonal';
    if (objLower.includes('loyalty') || objLower.includes('thank') || objLower.includes('appreciation')) return 'loyalty';
    if (objLower.includes('urgent') || objLower.includes('limited') || objLower.includes('last chance')) return 'urgent';
    
    return 'promotional'; // default
  }

  /**
   * Extract messages from AI response
   * @param {string} text - AI response text
   * @returns {Array<string>} Extracted messages
   */
  static extractMessages(text) {
    const messages = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for numbered messages or emoji-started messages
      if (/^\d+\./.test(trimmed) || /^[🎉💝⚡🔥👋✨💰🛍️🔄👑💎🌟🚀🎯🎄🌸☀️🙏⭐⏰🚨]/.test(trimmed)) {
        let message = trimmed.replace(/^\d+\.\s*/, '').trim();
        if (message.length > 10 && message.length <= 160) {
          messages.push(message);
        }
      }
    }
    
    return messages;
  }
}

// =============================================================================
// LOOKALIKE AUDIENCE ANALYZER
// =============================================================================

class LookalikeAnalyzer {
  /**
   * Analyze customer patterns for lookalike generation
   * @param {Array} customers - Customer data
   * @returns {Object} Analysis patterns
   */
  static analyzeCustomerPatterns(customers) {
    const analysis = {
      spendingTiers: { low: 0, medium: 0, high: 0, premium: 0 },
      visitFrequency: { occasional: 0, regular: 0, frequent: 0 },
      tenure: { new: 0, established: 0, longtime: 0 },
      commonTags: {},
      emailDomains: {},
      locationPatterns: {}
    };

    // Calculate percentiles for spending
    const spends = customers.map(c => c.total_spend || 0).sort((a, b) => a - b);
    const visits = customers.map(c => c.total_visits || 0).sort((a, b) => a - b);
    
    const getPercentile = (arr, p) => {
      const index = Math.ceil(arr.length * p / 100) - 1;
      return arr[Math.max(0, index)];
    };
    
    const spendP25 = getPercentile(spends, 25);
    const spendP50 = getPercentile(spends, 50);
    const spendP75 = getPercentile(spends, 75);
    const spendP90 = getPercentile(spends, 90);
    
    const visitP25 = getPercentile(visits, 25);
    const visitP75 = getPercentile(visits, 75);

    customers.forEach(customer => {
      const spend = customer.total_spend || 0;
      const visitCount = customer.total_visits || 0;
      const createdAt = new Date(customer.created_at);
      const daysSinceJoined = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

      // Categorize spending
      if (spend >= spendP90) analysis.spendingTiers.premium++;
      else if (spend >= spendP75) analysis.spendingTiers.high++;
      else if (spend >= spendP50) analysis.spendingTiers.medium++;
      else analysis.spendingTiers.low++;

      // Categorize visits
      if (visitCount >= visitP75) analysis.visitFrequency.frequent++;
      else if (visitCount >= visitP25) analysis.visitFrequency.regular++;
      else analysis.visitFrequency.occasional++;

      // Categorize tenure
      if (daysSinceJoined <= 30) analysis.tenure.new++;
      else if (daysSinceJoined <= 365) analysis.tenure.established++;
      else analysis.tenure.longtime++;

      // Analyze tags
      if (customer.tags && Array.isArray(customer.tags)) {
        customer.tags.forEach(tag => {
          analysis.commonTags[tag] = (analysis.commonTags[tag] || 0) + 1;
        });
      }

      // Analyze email domains
      if (customer.email) {
        const domain = customer.email.split('@')[1];
        if (domain) {
          analysis.emailDomains[domain] = (analysis.emailDomains[domain] || 0) + 1;
        }
      }

      // Analyze location patterns
      if (customer.address) {
        const addressParts = customer.address.split(',').map(part => part.trim());
        addressParts.forEach(part => {
          if (part.length > 2) {
            analysis.locationPatterns[part] = (analysis.locationPatterns[part] || 0) + 1;
          }
        });
      }
    });

    return {
      ...analysis,
      thresholds: { spendP25, spendP50, spendP75, spendP90, visitP25, visitP75 },
      totalCustomers: customers.length
    };
  }

  /**
   * Generate lookalike rules based on patterns
   * @param {Object} patterns - Customer patterns analysis
   * @returns {Object} Lookalike rules
   */
  static generateLookalikeRules(patterns) {
    const rules = { operator: "OR", conditions: [] };
    const conditionId = () => `lookalike_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Primary condition: Similar spending patterns
    if (patterns.thresholds.spendP50 > 0) {
      rules.conditions.push({
        id: conditionId(),
        field: "total_spend",
        operation: "between",
        value: [patterns.thresholds.spendP25, patterns.thresholds.spendP90 * 1.2],
      });
    }

    // Secondary condition: Similar visit patterns
    if (patterns.thresholds.visitP25 > 0) {
      rules.conditions.push({
        id: conditionId(),
        field: "total_visits",
        operation: "greaterThanOrEqual",
        value: Math.max(1, patterns.thresholds.visitP25),
      });
    }

    // Tertiary conditions: High-performing segments
    if (patterns.spendingTiers.premium > patterns.totalCustomers * 0.1) {
      rules.conditions.push({
        id: conditionId(),
        field: "total_spend",
        operation: "greaterThan",
        value: patterns.thresholds.spendP75,
      });
    }

    // Add common tag conditions
    const significantTags = Object.entries(patterns.commonTags)
      .filter(([tag, count]) => count > patterns.totalCustomers * 0.2)
      .map(([tag]) => tag);

    significantTags.slice(0, 2).forEach(tag => {
      rules.conditions.push({
        id: conditionId(),
        field: "tags",
        operation: "contains",
        value: tag,
      });
    });

    // Add email domain conditions for significant domains
    const significantDomains = Object.entries(patterns.emailDomains)
      .filter(([domain, count]) => count > patterns.totalCustomers * 0.15)
      .map(([domain]) => domain);

    significantDomains.slice(0, 2).forEach(domain => {
      rules.conditions.push({
        id: conditionId(),
        field: "email",
        operation: "endsWith",
        value: domain,
      });
    });

    // If we don't have enough conditions, add some broader ones
    if (rules.conditions.length < 2) {
      rules.conditions.push({
        id: conditionId(),
        field: "total_spend",
        operation: "greaterThan",
        value: Math.max(1000, patterns.thresholds.spendP25),
      });
      
      rules.conditions.push({
        id: conditionId(),
        field: "total_visits",
        operation: "greaterThan",
        value: Math.max(1, Math.floor(patterns.thresholds.visitP25 * 0.5)),
      });
    }

    return rules;
  }
}

// =============================================================================
// MAIN AI SERVICE FUNCTIONS
// =============================================================================

/**
 * Convert natural language to database query rules
 * @param {string} naturalLanguage - Natural language description
 * @returns {Promise<Object>} Database query rules
 */
const naturalLanguageToRules = async (naturalLanguage) => {
  try {
    console.log("Converting natural language to rules:", naturalLanguage);

    // Try AI model first with enhanced prompting
    try {
      console.log("Attempting to use AI model...");
      const generator = await aiModelManager.getModel();
      
      const prompt = `Convert this customer targeting description into precise database query rules:

"${naturalLanguage}"

Available customer fields:
- total_spend (number): Total amount spent by customer
- total_visits (number): Number of times customer visited  
- last_visit_date (date): Last time customer visited
- created_at (date): When customer account was created
- email (string): Customer email address
- address (string): Customer address
- tags (array): Customer tags/categories
- first_name, last_name (strings): Customer names

Available operations:
- equals, notEquals, greaterThan, lessThan, greaterThanOrEqual, lessThanOrEqual
- contains, notContains, startsWith, endsWith  
- between, notBetween, isEmpty, isNotEmpty
- isInLast, isNotInLast (for time-based filters)

Return ONLY this JSON format:
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

Examples:
- "customers who spent over 10000" → {"operator":"AND","conditions":[{"id":"condition_1","field":"total_spend","operation":"greaterThan","value":10000}]}
- "visited more than 5 times" → {"operator":"AND","conditions":[{"id":"condition_1","field":"total_visits","operation":"greaterThan","value":5}]}

Convert: "${naturalLanguage}"`;

      console.log("Generating response with AI model...");
      const response = await generator(prompt, {
        max_new_tokens: 300,
        do_sample: false,
        temperature: 0.1,
        repetition_penalty: 1.1,
        pad_token_id: 50256,
      });

      const generatedText = response[0].generated_text;
      console.log("AI model raw response:", generatedText);
      
      const aiRules = NaturalLanguageProcessor.extractJSON(generatedText);
      
      if (aiRules && aiRules.operator && aiRules.conditions && Array.isArray(aiRules.conditions)) {
        // Add IDs if missing and validate structure
        aiRules.conditions = aiRules.conditions.map((condition, index) => ({
          ...condition,
          id: condition.id || `condition_${Date.now()}_${index + 1}`
        }));
        
        // Basic validation
        const validConditions = aiRules.conditions.filter(condition => 
          condition.field && condition.operation && condition.value !== undefined
        );
        
        if (validConditions.length > 0) {
          aiRules.conditions = validConditions;
          console.log("Successfully generated rules using AI model:", JSON.stringify(aiRules, null, 2));
          return aiRules;
        }
      }
      
      throw new Error("Invalid rules structure from AI model");
      
    } catch (aiError) {
      console.log("AI model failed, using enhanced pattern matching:", aiError.message);
      
      // Use enhanced pattern matching
      const rules = NaturalLanguageProcessor.enhancedPatternMatching(naturalLanguage);

      // If no conditions were detected, create intelligent defaults based on keywords
      if (rules.conditions.length === 0) {
        console.log("No patterns matched, creating intelligent defaults");
        
        const text = naturalLanguage.toLowerCase();
        
        if (text.includes('customer') || text.includes('people') || text.includes('user')) {
          // Default to all active customers
          rules.conditions.push({
            id: `condition_${Date.now()}_default`,
            field: "total_spend",
            operation: "greaterThan",
            value: 0,
          });
        } else {
          // Very generic fallback
          rules.conditions.push({
            id: `condition_${Date.now()}_fallback`,
            field: "created_at",
            operation: "isNotEmpty",
            value: null,
          });
        }
      }

      console.log("Generated rules using enhanced pattern matching:", JSON.stringify(rules, null, 2));
      return rules;
    }

  } catch (err) {
    console.error("Error converting natural language to rules:", err);
    
    // Return basic fallback rules with explanation
    return {
      operator: "AND",
      conditions: [{
        id: `condition_${Date.now()}_emergency_fallback`,
        field: "total_spend",
        operation: "greaterThan",
        value: 0,
      }],
      _meta: {
        fallback: true,
        originalInput: naturalLanguage,
        error: err.message
      }
    };
  }
};

/**
 * Generate message suggestions based on campaign objective
 * @param {string} campaignObjective - Campaign objective
 * @param {Object} segmentData - Segment data for context
 * @returns {Promise<Array<string>>} Message suggestions
 */
const generateMessageSuggestions = async (campaignObjective, segmentData = null) => {
  try {
    console.log("Generating message suggestions for:", campaignObjective);
    
    const category = MessageGenerator.determineCategory(campaignObjective);
    const audienceContext = segmentData && segmentData.audienceSize ? 
      `targeting ${segmentData.audienceSize} customers` : 
      'for targeted audience';
    
    // Try AI model first for more creative suggestions
    try {
      console.log("Attempting to use AI model for message generation...");
      const generator = await aiModelManager.getModel();
      
      const prompt = `Generate 3 engaging marketing message templates for a ${campaignObjective} campaign ${audienceContext}.

Requirements:
- Each message should be under 160 characters
- Include relevant emojis
- Add personalization placeholders like {firstName}, {discount}, {productName}
- Make them actionable with clear call-to-action
- Vary the tone and approach

Category: ${category}
Objective: ${campaignObjective}

Example format:
1. 🎉 [Message with {placeholder}]
2. 💝 [Different tone message]
3. ⚡ [Urgent/action-oriented message]

Generate 3 marketing messages:`;

      const response = await generator(prompt, {
        max_new_tokens: 200,
        do_sample: true,
        temperature: 0.7,
        repetition_penalty: 1.1,
        pad_token_id: 50256,
      });

      const generatedText = response[0].generated_text;
      console.log("AI model response for messages:", generatedText);
      
      const messages = MessageGenerator.extractMessages(generatedText);
      
      // If we got good AI messages, return them
      if (messages.length >= 2) {
        console.log("Successfully generated messages using AI model");
        return messages.slice(0, 3); // Return up to 3 messages
      }
      
      throw new Error("Not enough valid messages from AI model");
      
    } catch (aiError) {
      console.log("AI model failed for message generation, using templates:", aiError.message);
    }
    
    // Fallback to template-based generation with smart placeholders
    const categoryData = MessageGenerator.MESSAGE_CATEGORIES[category];
    const templates = categoryData.templates;
    const defaults = categoryData.defaults;
    
    // Create smart placeholders based on segment data
    const placeholders = {
      ...defaults,
      firstName: "{firstName}",
      productName: "{productName}",
      storeName: "{storeName}",
    };
    
    // Adjust defaults based on campaign objective
    const objective = campaignObjective.toLowerCase();
    if (objective.includes('flash') || objective.includes('urgent')) {
      placeholders.hours = 6;
      placeholders.discount = 30;
    } else if (objective.includes('premium') || objective.includes('vip')) {
      placeholders.discount = 25;
    } else if (objective.includes('first time') || objective.includes('welcome')) {
      placeholders.discount = 10;
    }
    
    // Generate messages by filling templates
    const messages = templates.map(template => {
      let message = template;
      Object.keys(placeholders).forEach(key => {
        const placeholder = `{${key}}`;
        if (message.includes(placeholder)) {
          message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), placeholders[key]);
        }
      });
      return message;
    });
    
    console.log("Generated message suggestions using templates:", messages);
    return messages;

  } catch (err) {
    console.error("Error generating message suggestions:", err);
    
    // Emergency fallback messages
    return [
      "🎉 Special offer just for you! Don't miss out on this amazing deal!",
      "💝 Thank you for being our valued customer. Here's something special!",
      "⚡ Limited time offer! Act fast and save big on your favorite items!"
    ];
  }
};

/**
 * Generate lookalike audience based on campaign analysis
 * @param {string} campaignId - Campaign ID for analysis
 * @param {Object} segmentData - Optional segment data for context
 * @returns {Promise<Object>} Lookalike audience rules and insights
 */
const generateLookalikeAudience = async (campaignId, segmentData = null) => {
  try {
    console.log("Generating lookalike audience for campaign:", campaignId);

    // Get successful campaign data for analysis
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'completed')
      .gte('success_rate', 0.1) // At least 10% success rate
      .order('success_rate', { ascending: false })
      .limit(10);

    if (campaignError) {
      console.error("Error fetching successful campaigns:", campaignError);
      throw campaignError;
    }

    let sourceCustomers = [];
    
    if (campaigns && campaigns.length > 0) {
      console.log(`Found ${campaigns.length} successful campaigns for analysis`);
      
      // Get customers from successful campaigns
      const campaignIds = campaigns.map(c => c.id);
      
      const { data: successfulCustomers, error: customerError } = await supabase
        .from('communication_logs')
        .select(`
          customer_id,
          customers (
            id, email, first_name, last_name, phone, address,
            total_spend, total_visits, last_visit_date, created_at, tags
          )
        `)
        .in('campaign_id', campaignIds)
        .eq('status', 'delivered')
        .not('customers.total_spend', 'is', null);

      if (!customerError && successfulCustomers) {
        sourceCustomers = successfulCustomers
          .map(log => log.customers)
          .filter(customer => customer && customer.total_spend > 0);
        
        console.log(`Found ${sourceCustomers.length} customers from successful campaigns`);
      }
    }

    // If no successful campaign data, use segment data or high-value customers
    if (sourceCustomers.length === 0) {
      console.log("No successful campaign data found, using alternative sources");
      
      // Try to use current segment data if available
      if (segmentData && segmentData.rules) {
        console.log("Using current segment for lookalike generation");
        
        // Build query from segment rules (simplified version)
        let query = supabase.from('customers').select('*');
        
        // Apply basic filters from segment rules
        if (segmentData.rules.conditions) {
          for (const condition of segmentData.rules.conditions) {
            if (condition.field === 'total_spend' && condition.operation === 'greaterThan') {
              query = query.gte('total_spend', condition.value);
            } else if (condition.field === 'total_visits' && condition.operation === 'greaterThan') {
              query = query.gte('total_visits', condition.value);
            }
          }
        }
        
        const { data: segmentCustomers, error: segmentError } = await query.limit(100);
        
        if (!segmentError && segmentCustomers) {
          sourceCustomers = segmentCustomers;
          console.log(`Using ${sourceCustomers.length} customers from current segment`);
        }
      }
      
      // Final fallback: use high-value customers
      if (sourceCustomers.length === 0) {
        console.log("Using high-value customers as source");
        
        const { data: highValueCustomers, error: hvError } = await supabase
          .from('customers')
          .select('*')
          .gte('total_spend', 5000)
          .gte('total_visits', 3)
          .order('total_spend', { ascending: false })
          .limit(50);
        
        if (!hvError && highValueCustomers) {
          sourceCustomers = highValueCustomers;
          console.log(`Using ${sourceCustomers.length} high-value customers`);
        }
      }
    }

    if (sourceCustomers.length === 0) {
      throw new Error("No source customers found for lookalike audience generation");
    }

    const patterns = LookalikeAnalyzer.analyzeCustomerPatterns(sourceCustomers);
    console.log("Analyzed customer patterns:", patterns);

    const lookalikeRules = LookalikeAnalyzer.generateLookalikeRules(patterns);
    
    // Estimate audience size for the lookalike
    let estimatedSize = 0;
    try {
      // Try to estimate audience size (simplified query)
      const { data: countData, error: countError } = await supabase
        .from('customers')
        .select('id', { count: 'exact' })
        .gte('total_spend', patterns.thresholds.spendP25)
        .gte('total_visits', Math.max(1, patterns.thresholds.visitP25));
      
      if (!countError) {
        estimatedSize = countData ? countData.length : 0;
      }
    } catch (countErr) {
      console.log("Could not estimate audience size:", countErr.message);
    }

    const lookalike = {
      rules: lookalikeRules,
      audienceSize: estimatedSize,
      sourceAnalysis: {
        sourceCount: sourceCustomers.length,
        patterns: {
          avgSpend: patterns.thresholds.spendP50,
          avgVisits: Math.round(patterns.thresholds.visitP25),
          topTags: Object.entries(patterns.commonTags)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([tag]) => tag),
          topDomains: Object.keys(patterns.emailDomains).slice(0, 2)
        }
      },
      confidence: Math.min(95, 60 + (sourceCustomers.length * 2)), // Confidence based on source size
      generation_method: campaigns?.length > 0 ? 'successful_campaigns' : 'high_value_analysis'
    };

    console.log("Generated lookalike audience:", JSON.stringify(lookalike, null, 2));
    return lookalike;

  } catch (err) {
    console.error("Error generating lookalike audience:", err);
    
    // Fallback lookalike audience
    return {
      rules: {
        operator: "OR",
        conditions: [
          {
            id: `fallback_${Date.now()}_1`,
            field: "total_spend",
            operation: "greaterThan",
            value: 2000,
          },
          {
            id: `fallback_${Date.now()}_2`,
            field: "total_visits",
            operation: "greaterThan",
            value: 2,
          }
        ],
      },
      audienceSize: 0,
      sourceAnalysis: null,
      confidence: 30,
      generation_method: 'fallback',
      error: err.message
    };
  }
};

// =============================================================================
// INITIALIZATION AND CLEANUP
// =============================================================================

// Initialize model when the service starts
aiModelManager.initializeModel().catch(err => {
  console.error("Failed to initialize AI model on startup:", err);
});

// Handle process cleanup
process.on('SIGINT', () => aiModelManager.cleanup());
process.on('SIGTERM', () => aiModelManager.cleanup());
process.on('exit', () => aiModelManager.cleanup());

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  naturalLanguageToRules,
  generateMessageSuggestions,
  generateLookalikeAudience,
  initializeModel: () => aiModelManager.initializeModel(),
  getModel: () => aiModelManager.getModel(), // Export for testing
};
