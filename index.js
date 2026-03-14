import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import serverless from 'serverless-http';

dotenv.config();

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

// ─── MongoDB ──────────────────────────────────────────────────────────────────
// Don't buffer commands — fail fast if not yet connected instead of queuing forever.
mongoose.set('bufferCommands', false);

let dbPromise = null;

const connectDB = () => {
  if (dbPromise) return dbPromise;
  dbPromise = mongoose
    .connect(config.MONGO_URI, { family: 4, serverSelectionTimeoutMS: 10000 })
    .then(() => console.log('Database connected successfully'))
    .catch((err) => {
      console.error('Database connection error:', err.message);
      dbPromise = null; // allow retry on next request
    });
  return dbPromise;
};

// Kick off the connection immediately at module load (warm-up on first import)
if (process.env.NODE_ENV !== 'test') connectDB();

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();

// Trust Vercel's reverse proxy so req.ip resolves correctly
app.set('trust proxy', 1);

// Security
app.use(helmet());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    return forwarded ? forwarded.split(',')[0].trim() : (req.ip || 'unknown');
  },
});
app.use(limiter);

// CORS — hardcoded production origin as fallback so a missing env var never breaks the app
const HARDCODED_ORIGINS = ['https://library-athenaeum-frontend.vercel.app'];
const envOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, ''))
  : [];
const allowedOrigins = Array.from(new Set([...HARDCODED_ORIGINS, ...envOrigins]));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // server-to-server / curl / cron
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

// Ensure DB is connected before every request (non-blocking re-use if already connected)
app.use(async (req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Health-check
app.get('/', (req, res) => res.status(200).json({ status: 'ok', message: 'Athenaeum API running' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/borrowed', borrowedRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/google-books', googleBooksRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/admin-tools', adminToolsRoutes);
app.use('/api/cron', cronRoutes);

// Error handler
app.use(errorHandler);

// ─── Local dev server ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  connectDB().then(() => {
    const server = app.listen(config.PORT, () =>
      console.log(`Server listening on port ${config.PORT}`)
    );
    process.on('SIGTERM', () => {
      server.close(() => console.log('Process terminated'));
    });
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default process.env.NODE_ENV === 'test' ? app : serverless(app);
