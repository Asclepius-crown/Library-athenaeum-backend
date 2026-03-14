//
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
import path from 'path';

global.isConnected = false;

dotenv.config();

const app = express();

let exportedApp = app;
export default exportedApp;

// Security Middleware
app.use(helmet());

// Rate Limiting (skip in serverless/test environments)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in test/serverless environments
  skip: (req) => process.env.NODE_ENV === 'test' || process.env.VERCEL,
});
app.use(limiter);

// CORS Configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.options('*', cors());

app.use(express.json());

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

const connectDB = async () => {
  if (global.isConnected) return;
  try {
    const db = await mongoose.connect(config.MONGO_URI, {
      family: 4, 
    });
    global.isConnected = db.connections[0].readyState;
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection error:', error);
  }
};

// Middleware to ensure DB is connected on every request
app.use(async (req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();
  await connectDB();
  next();
});

if (process.env.NODE_ENV !== 'test') {
  exportedApp = serverless(app);
}

// --- Server Start (Local Dev Only) ---
// If running locally (not imported as a module by Vercel), start listening AND connect immediately
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  connectDB().then(() => {
    const server = app.listen(config.PORT, () => console.log(`Server listening on port ${config.PORT}`));
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
      });
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
  });
}