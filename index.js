import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

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
mongoose.set('bufferCommands', false);

let dbPromise = null;

const connectDB = () => {
  if (dbPromise) return dbPromise;
  dbPromise = mongoose
    .connect(config.MONGO_URI, {
      family: 4,
      serverSelectionTimeoutMS: 10000,
    })
    .then(() => console.log('Database connected successfully'))
    .catch((err) => {
      console.error('Database connection error:', err.message);
      dbPromise = null;
    });
  return dbPromise;
};

// Start connecting immediately on module load (cold-start warm-up)
if (process.env.NODE_ENV !== 'test') connectDB();

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();

app.set('trust proxy', 1);

app.use(helmet());

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

// CORS
app.use(cors({
  origin: 'https://library-athenaeum-frontend.vercel.app',
  credentials: true
}));
app.options('*', cors());

app.use(express.json());

// Ensure DB connected before every request
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

app.use(errorHandler);

// ─── Local dev ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  connectDB().then(() => {
    const server = app.listen(config.PORT, () =>
      console.log(`Server listening on port ${config.PORT}`)
    );
    process.on('SIGTERM', () => server.close());
  });
}

// Export plain Express app — @vercel/node handles it natively, no serverless-http needed
export default app;
