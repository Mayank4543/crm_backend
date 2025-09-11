// Redis configuration
const Redis = require('redis');
const dotenv = require('dotenv');

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client
const redisClient = Redis.createClient({
  url: REDIS_URL
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (err) {
    console.error('Redis connection error:', err);
  }
})();

// Handle Redis errors
redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

module.exports = {
  redisClient,
  // Define Redis channels/streams
  channels: {
    CUSTOMER_CREATED: 'customer:created',
    ORDER_CREATED: 'order:created',
    CAMPAIGN_CREATED: 'campaign:created',
    DELIVERY_STATUS: 'delivery:status'
  }
};
