#!/usr/bin/env node

/**
 * Script para agregar dominios automáticamente a Firebase
 * Uso: node scripts/add-domain.js <dominio>
 * Ejemplo: node scripts/add-domain.js files.controldoc.app
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

function success(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function info(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function warning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

async function main() {
  const domain = process.argv[2];

  if (!domain) {
    error('Por favor proporciona un dominio como argumento');
    console.log('Uso: node scripts/add-domain.js <dominio>');
    console.log('Ejemplo: node scripts/add-domain.js files.controldoc.app');
    process.exit(1);
  }

  log(`🚀 Agregando dominio: ${domain}`, 'cyan');

  try {
    // Verificar si Firebase CLI está instalado
    try {
      execSync('firebase --version', { stdio: 'pipe' });
    } catch (e) {
      error('Firebase CLI no está instalado');
      info('Instala Firebase CLI con: npm install -g firebase-tools');
      process.exit(1);
    }

    // Verificar si el usuario está autenticado
    try {
      execSync('firebase auth:list', { stdio: 'pipe' });
    } catch (e) {
      error('No estás autenticado en Firebase');
      info('Ejecuta: firebase login');
      process.exit(1);
    }

    // Obtener el proyecto actual
    let projectId;
    try {
      const firebaseRc = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));
      projectId = firebaseRc.projects.default;
    } catch (e) {
      error('No se pudo leer .firebaserc');
      info('Asegúrate de estar en el directorio raíz del proyecto');
      process.exit(1);
    }

    info(`Proyecto Firebase: ${projectId}`);

    // Agregar el dominio a Firebase Auth
    log('Agregando dominio a Firebase Auth...', 'yellow');
    
    try {
      execSync(`firebase auth:domains:add ${domain}`, { stdio: 'inherit' });
      success(`Dominio ${domain} agregado a Firebase Auth`);
    } catch (e) {
      warning(`No se pudo agregar el dominio a Firebase Auth automáticamente`);
      info('Agrega manualmente el dominio en Firebase Console > Authentication > Settings > Authorized domains');
    }

    // Actualizar la configuración de dominios
    log('Actualizando configuración de dominios...', 'yellow');
    
    const domainConfigPath = path.join(__dirname, '..', 'lib', 'domain-config.ts');
    let domainConfig = fs.readFileSync(domainConfigPath, 'utf8');

    // Verificar si el dominio ya existe en la configuración
    if (domainConfig.includes(`'${domain}':`)) {
      warning(`El dominio ${domain} ya existe en la configuración`);
    } else {
      // Agregar el nuevo dominio a la configuración
      const newDomainConfig = `  '${domain}': {
    domain: '${domain}',
    firebaseConfig: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      authDomain: '${projectId}.firebaseapp.com',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    },
  },`;

      // Insertar antes del comentario "Agregar más dominios aquí"
      const insertIndex = domainConfig.indexOf('  // Agregar más dominios aquí');
      if (insertIndex !== -1) {
        domainConfig = domainConfig.slice(0, insertIndex) + newDomainConfig + '\n  ' + domainConfig.slice(insertIndex);
        fs.writeFileSync(domainConfigPath, domainConfig);
        success(`Dominio ${domain} agregado a la configuración`);
      } else {
        error('No se pudo actualizar la configuración automáticamente');
        info('Agrega manualmente el dominio en lib/domain-config.ts');
      }
    }

    // Crear archivo de configuración para el dominio
    const envExamplePath = path.join(__dirname, '..', 'env.example');
    const envContent = `# Configuración para ${domain}
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${projectId}.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${projectId}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${projectId}.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Backblaze B2 (opcional)
B2_KEY_ID=your_b2_key_id
B2_APPLICATION_KEY=your_b2_application_key
B2_BUCKET_ID=your_b2_bucket_id
B2_BUCKET_NAME=your_b2_bucket_name
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com

# App Config
NEXT_PUBLIC_APP_URL=https://${domain}
`;

    const envFileName = `.env.${domain.replace(/\./g, '_')}`;
    const envFilePath = path.join(__dirname, '..', envFileName);
    
    if (!fs.existsSync(envFilePath)) {
      fs.writeFileSync(envFilePath, envContent);
      success(`Archivo de configuración creado: ${envFileName}`);
    } else {
      warning(`El archivo ${envFileName} ya existe`);
    }

    success(`🎉 Dominio ${domain} configurado exitosamente!`);
    
    info('Próximos pasos:');
    info('1. Agrega el dominio en Firebase Console > Authentication > Settings > Authorized domains');
    info('2. Configura las variables de entorno en el archivo .env.local');
    info('3. Despliega la aplicación en el nuevo dominio');

  } catch (err) {
    error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
