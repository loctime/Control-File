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

const app = express();
const PORT = process.env.PORT || 3002;

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
  }
});

// Middleware
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
    console.log('🔍 Global middleware - Content-Type:', req.headers['content-type']);
    console.log('🔍 Global middleware - Body:', req.body);
  }
  next();
});

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000',
      'https://files.controldoc.app',
      'https://controldoc.app'
    ];

console.log('🌐 CORS allowed origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
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
app.use(cors(corsOptions));
// Ensure Express responds to preflight with proper CORS headers
app.options('*', cors(corsOptions));

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

// Handle OPTIONS requests for uploads before auth middleware
app.options('/api/uploads/*', cors(corsOptions), (req, res) => {
  console.log('🔍 OPTIONS request for uploads - Origin:', req.headers.origin);
  res.sendStatus(200);
});

// Protected routes with auth
app.use('/api/uploads', authMiddleware, (req, res, next) => {
  console.log('🔍 Debug middleware - Method:', req.method);
  console.log('🔍 Debug middleware - Content-Type:', req.headers['content-type']);
  console.log('🔍 Debug middleware - Body after auth:', req.body);
  next();
}, uploadRoutes);
// Handle OPTIONS requests for other protected routes
app.options('/api/files/*', cors(corsOptions), (req, res) => {
  console.log('🔍 OPTIONS request for files - Origin:', req.headers.origin);
  res.sendStatus(200);
});

app.options('/api/shares/*', cors(corsOptions), (req, res) => {
  console.log('🔍 OPTIONS request for shares - Origin:', req.headers.origin);
  res.sendStatus(200);
});

app.options('/api/folders/*', cors(corsOptions), (req, res) => {
  console.log('🔍 OPTIONS request for folders - Origin:', req.headers.origin);
  res.sendStatus(200);
});

app.use('/api/files', authMiddleware, filesRoutes);
app.use('/api/shares', authMiddleware, sharesRoutes);
app.use('/api/folders', authMiddleware, foldersRoutes);
app.use('/api/user', authMiddleware, userRoutes);

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
