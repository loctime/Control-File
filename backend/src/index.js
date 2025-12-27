// backend/src/index.js
const express = require('express');
const githubAuthRoutes = require('./routes/auth-github');
const githubCallbackRoutes = require('./routes/auth-github-callback');
const githubReposRoutes = require('./routes/github-repos');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authMiddleware = require('./middleware/auth');
const uploadRoutes = require('./routes/upload');
const externalUploadRoutes = require('./routes/external-upload');
const filesRoutes = require('./routes/files');
const sharesRoutes = require('./routes/shares');
const healthRoutes = require('./routes/health');
const foldersRoutes = require('./routes/folders');
// const userRoutes = require('./routes/user'); // Archivo no existe
const usersRoutes = require('./routes/users');
const audioRoutes = require('./routes/audio');
const storesRoutes = require('./routes/stores/sheets');
const { getCacheStats, clearCache } = require('./middleware/cache');
const { logger } = require('./utils/logger');
const requestLogger = require('./middleware/request-logger');

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

logger.info('CORS allowed origins', { allowedOrigins });

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      logger.debug('CORS allowed origin', { origin });
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin', { origin });
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
app.use(requestLogger);

// Body parsing middleware with logging
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug middleware for all requests
app.use((req, res, next) => {
  if (req.path.startsWith('/api/uploads')) {
    logger.debug('Uploads debug', {
      path: req.path,
      method: req.method,
      origin: req.headers.origin,
      contentType: req.headers['content-type'],
    });
  }
  next();
});

// Health check route (no auth required) - disponible en /health y /api/health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'controlfile',
    storage: 'backblaze',
    auth: 'firebase',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});
app.use('/api/health', healthRoutes);

// Test route without auth
app.post('/api/test-upload', (req, res) => {
  logger.info('Test upload endpoint', {
    headers: req.headers,
  });
  res.json({ 
    success: true, 
    body: req.body, 
    headers: req.headers 
  });
});

// External upload endpoint - POST /upload (sin /api) para aplicaciones externas
// Este es el endpoint único y oficial para subida de archivos desde apps externas
app.post('/upload', authMiddleware, externalUploadRoutes);

// Protected routes with auth
app.use('/api/uploads', authMiddleware, (req, res, next) => {
  logger.debug('Uploads after auth', {
    method: req.method,
    contentType: req.headers['content-type'],
  });
  next();
}, uploadRoutes);
app.use('/api', githubAuthRoutes);
app.use('/api', githubCallbackRoutes);
app.use('/api/github', authMiddleware, githubReposRoutes);

// Protected routes with auth
app.use('/api/files', authMiddleware, filesRoutes);
app.use('/api/folders', authMiddleware, foldersRoutes);
// app.use('/api/user', authMiddleware, userRoutes); // Ruta deshabilitada: no existe ./routes/user
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
  logger.error('Unhandled error', { error: err, path: req.path });
  
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
