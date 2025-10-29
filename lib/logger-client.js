// lib/logger-client.js
// Sistema de logging para el frontend (Next.js + React) - Versión JavaScript

class ClientLogger {
  constructor() {
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // En desarrollo: mostrar todos los logs
    // En producción: solo info, warn, error
    this.currentLevel = this.isDevelopment ? this.levels.debug : this.levels.info;
  }

  shouldLog(level) {
    return level >= this.currentLevel;
  }

  formatMessage(level, message, metadata) {
    const timestamp = new Date().toLocaleTimeString();
    
    if (this.isDevelopment) {
      // En desarrollo: formato legible con colores
      const colors = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
        reset: '\x1b[0m'
      };
      
      const color = colors[level] || colors.reset;
      const reset = colors.reset;
      
      let formatted = `${color}[${timestamp}] [${level.toUpperCase()}]: ${message}${reset}`;
      
      if (metadata && Object.keys(metadata).length > 0) {
        formatted += `\n${color}  📊 Metadata: ${JSON.stringify(metadata, null, 2)}${reset}`;
      }
      
      return formatted;
    } else {
      // En producción: JSON estructurado
      const logEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        service: 'controlfile-frontend',
        environment: process.env.NODE_ENV || 'development',
        ...(metadata && { metadata })
      };
      
      return JSON.stringify(logEntry);
    }
  }

  log(level, message, metadata) {
    const levelNum = this.levels[level];
    
    if (!this.shouldLog(levelNum)) {
      return;
    }

    const formatted = this.formatMessage(level, message, metadata);
    
    // Usar console apropiado según el nivel
    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
      default:
        console.log(formatted);
    }

    // En producción, también enviar a un servicio de logging si está configurado
    if (this.isProduction && levelNum >= this.levels.warn) {
      this.sendToLoggingService(level, message, metadata);
    }
  }

  async sendToLoggingService(level, message, metadata) {
    try {
      // Aquí podrías enviar logs a un servicio externo como:
      // - Sentry
      // - LogRocket
      // - Tu propio endpoint de logging
      // - Datadog
      
      // Por ahora, solo lo dejamos preparado para futuras implementaciones
      if (process.env.NEXT_PUBLIC_LOGGING_ENDPOINT) {
        await fetch(process.env.NEXT_PUBLIC_LOGGING_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            level,
            message,
            metadata,
            timestamp: new Date().toISOString(),
            service: 'controlfile-frontend',
            environment: process.env.NODE_ENV,
            url: typeof window !== 'undefined' ? window.location.href : 'server',
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
          }),
        });
      }
    } catch (error) {
      // No hacer nada si falla el envío de logs
      // No queremos que el logging rompa la aplicación
    }
  }

  debug(message, metadata) {
    this.log('debug', message, metadata);
  }

  info(message, metadata) {
    this.log('info', message, metadata);
  }

  warn(message, metadata) {
    this.log('warn', message, metadata);
  }

  error(message, metadata) {
    this.log('error', message, metadata);
  }

  // Método para cambiar el nivel de logging dinámicamente
  setLevel(level) {
    this.currentLevel = this.levels[level];
  }

  // Método para obtener el nivel actual
  getLevel() {
    return Object.keys(this.levels).find(key => 
      this.levels[key] === this.currentLevel
    ) || 'info';
  }
}

// Crear instancia singleton
const logger = new ClientLogger();

// Función helper para errores comunes
const logError = (error, context, metadata) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  logger.error(`Error${context ? ` in ${context}` : ''}`, {
    message: errorMessage,
    stack: errorStack,
    ...metadata
  });
};

// Función helper para operaciones exitosas
const logSuccess = (operation, metadata) => {
  logger.info(`✅ ${operation}`, metadata);
};

// Función helper para operaciones de debug
const logDebug = (operation, metadata) => {
  logger.debug(`🔍 ${operation}`, metadata);
};

module.exports = { logger, logError, logSuccess, logDebug };
