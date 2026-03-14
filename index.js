import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import serverless from 'serverless-http';

import config from "./config.js";
import authRoutes from "./routes/auth.js";
import booksRoutes from "./routes/books.js";
import borrowedRoutes from "./routes/borrowed.js";
import studentRoutes from "./routes/students.js";
import googleBooksRoutes from "./routes/googleBooks.js";
import usersRoutes from "./routes/users.js";
import dashboardRoutes from "./routes/dashboard.js";
import reservationRoutes from "./routes/reservations.js";
import reviewRoutes from "./routes/reviews.js";
import analyticsRoutes from "./routes/analytics.js";
import announcementRoutes from "./routes/announcements.js";
import adminToolsRoutes from "./routes/adminTools.js";
import cronRoutes from "./routes/cron.js";
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

global.isConnected = false;

const app = express();

// Trust Vercel's reverse proxy so req.ip resolves correctly (required for express-rate-limit)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());

// Rate Limiting
// On Vercel, use X-Forwarded-For as the key to avoid ERR_ERL_FORWARDED_HEADER warnings.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || 'unknown';
  },
});
app.use(limiter);

// CORS Configuration
// Build allowed origins list from CORS_ORIGIN env var (comma-separated) plus
// the hardcoded production frontend as a safety net so a missing env var
// doesn't block all requests.
const HARDCODED_ORIGINS = [
  'https://library-athenaeum-frontend.vercel.app',
];
const envOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, ''))
  : [];
const allowedOrigins = Array.from(new Set([...HARDCODED_ORIGINS, ...envOrigins]));

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Vercel cron)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

// DB Connection Middleware — must be registered BEFORE routes
const connectDB = async () => {
  if (global.isConnected) return;
  try {
    const db = await mongoose.connect(config.MONGO_URI, { family: 4 });
    global.isConnected = db.connections[0].readyState;
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection error:', error);
  }
};

app.use(async (req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();
  await connectDB();
  next();
});

// Health-check route
app.get("/", (req, res) => res.status(200).send("Athenaeum backend API running"));

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/books", booksRoutes);
app.use("/api/borrowed", borrowedRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/google-books", googleBooksRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/admin-tools", adminToolsRoutes);
app.use("/api/cron", cronRoutes);

// Error Handling Middleware
app.use(errorHandler);

// --- Server Start (Local Dev Only) ---
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  connectDB().then(() => {
    const server = app.listen(config.PORT, () =>
      console.log(`Server listening on port ${config.PORT}`)
    );
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => console.log('Process terminated'));
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
  });
}

// Export: serverless wrapper for Vercel, raw app for tests
export default process.env.NODE_ENV === 'test' ? app : serverless(app);
