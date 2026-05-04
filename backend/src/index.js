// TalentMatch Backend - Main Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const paymentRoutes = require('./routes/payments');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');

const app = express();
const prisma = new PrismaClient();

// Make prisma available on app
app.set('prisma', prisma);

// ---- Security Middleware ----
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

// ---- Stripe webhook MUST be before json parser ----
// (raw body needed for signature verification)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// ---- Body Parsing ----
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Logging ----
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ---- Rate Limiting ----
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Auth endpoints get stricter limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts, please try again later.' },
});
app.use('/api/auth/', authLimiter);

// ---- Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

// ---- Health Check ----
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- 404 Handler ----
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---- Global Error Handler ----
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message;
  res.status(statusCode).json({ error: message });
});

// ---- Start Server ----
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`TalentMatch API running on port ${PORT}`);
});

// ---- Graceful Shutdown ----
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;
