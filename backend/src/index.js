const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authMiddleware = require('./middleware/auth');
const uploadRoutes = require('./routes/upload');
const filesRoutes = require('./routes/files');
const sharesRoutes = require('./routes/shares');
const healthRoutes = require('./routes/health');
const foldersRoutes = require('./routes/folders');
const userRoutes = require('./routes/user');
const usersRoutes = require('./routes/users');
const audioRoutes = require('./routes/audio');
const storesRoutes = require('./routes/stores/sheets');
const { getCacheStats, clearCache } = require('./middleware/cache');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for Render.com and other reverse proxies
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
  }
});

// CORS configuration MUST come before rate limiting to handle preflight requests
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:5173',
      'https://files.controldoc.app',
      'https://controldoc.app',
      'https://stock.controldoc.app',
      'https://gastos.controldoc.app',
      'https://auditoria.controldoc.app'
    ];

console.log('🌐 CORS allowed origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('✅ CORS allowed origin:', origin);
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// Apply CORS FIRST before any other middleware
app.use(cors(corsOptions));
// Handle all OPTIONS requests with CORS
app.options('*', cors(corsOptions));

// Now apply other middleware AFTER CORS
app.use(helmet());
app.use(compression());
app.use(limiter);

// Body parsing middleware with logging
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug middleware for all requests
app.use((req, res, next) => {
  if (req.path.startsWith('/api/uploads')) {
    console.log('🔍 Global middleware - Path:', req.path);
    console.log('🔍 Global middleware - Method:', req.method);
    console.log('🔍 Global middleware - Origin:', req.headers.origin);
    console.log('🔍 Global middleware - Content-Type:', req.headers['content-type']);
    console.log('🔍 Global middleware - Body:', req.body);
  }
  next();
});

// Health check route (no auth required)
app.use('/api/health', healthRoutes);

// Test route without auth
app.post('/api/test-upload', (req, res) => {
  console.log('🧪 Test upload endpoint - Headers:', req.headers);
  console.log('🧪 Test upload endpoint - Body:', req.body);
  res.json({ 
    success: true, 
    body: req.body, 
    headers: req.headers 
  });
});

// Protected routes with auth
app.use('/api/uploads', authMiddleware, (req, res, next) => {
  console.log('🔍 Debug middleware - Method:', req.method);
  console.log('🔍 Debug middleware - Content-Type:', req.headers['content-type']);
  console.log('🔍 Debug middleware - Body after auth:', req.body);
  next();
}, uploadRoutes);

// Protected routes with auth
app.use('/api/files', authMiddleware, filesRoutes);
app.use('/api/folders', authMiddleware, foldersRoutes);
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/audio', authMiddleware, audioRoutes);
app.use('/api/stores', authMiddleware, storesRoutes);

// Shares routes - mixed public and protected
app.use('/api/shares', sharesRoutes);

// TanStack Cache endpoints
app.get('/api/cache/stats', authMiddleware, getCacheStats);
app.post('/api/cache/clear', authMiddleware, clearCache);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ 
      error: 'El archivo es demasiado grande',
      maxSize: '10MB'
    });
  }
  
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend ejecutándose en puerto ${PORT}`);
  console.log(`📁 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`🔐 Firebase Project ID: ${process.env.FIREBASE_PROJECT_ID || 'NO CONFIGURADO'}`);
  console.log(`📦 B2 Bucket: ${process.env.B2_BUCKET_NAME || 'NO CONFIGURADO'}`);
});

module.exports = app;
