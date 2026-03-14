import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];

// Check for missing environment variables
const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`FATAL ERROR: Missing required environment variables: ${missing.join(', ')}`);
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const config = {
  PORT: process.env.PORT || 3000,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
};

export default config;