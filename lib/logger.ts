// lib/logger.ts - Sistema de logging estructurado
import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Formato personalizado para desarrollo
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata, null, 2)}`;
    }
    return msg;
  })
);

// Formato para producción (JSON estructurado)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Crear logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  format: isDevelopment ? devFormat : prodFormat,
  defaultMeta: { 
    service: 'controlfile-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Consola
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

// Si estamos en producción, agregar archivo de logs
if (isProduction) {
  logger.add(
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Helper functions para logging con contexto
export const logApiRequest = (method: string, path: string, userId?: string) => {
  logger.info('API Request', { method, path, userId });
};

export const logApiError = (method: string, path: string, error: Error, userId?: string) => {
  logger.error('API Error', {
    method,
    path,
    userId,
    error: error.message,
    stack: error.stack,
  });
};

export const logFileOperation = (
  operation: string,
  fileId: string,
  userId: string,
  metadata?: Record<string, any>
) => {
  logger.info('File Operation', {
    operation,
    fileId,
    userId,
    ...metadata,
  });
};

export const logUpload = (
  userId: string,
  fileName: string,
  fileSize: number,
  status: 'started' | 'completed' | 'failed',
  metadata?: Record<string, any>
) => {
  const level = status === 'failed' ? 'error' : 'info';
  logger.log(level, 'Upload', {
    userId,
    fileName,
    fileSize,
    status,
    ...metadata,
  });
};

export default logger;

