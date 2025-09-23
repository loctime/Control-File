// Script para probar la configuración de CORS
const https = require('https');

const testOrigins = [
  'http://localhost:3000',
  'https://files.controldoc.app',
  'https://controldoc.app',
  'https://malicious-site.com' // Este debería ser bloqueado
];

const backendUrl = 'https://controlfile.onrender.com';

async function testCORS(origin) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'controlfile.onrender.com',
      port: 443,
      path: '/api/health',
      method: 'GET',
      headers: {
        'Origin': origin,
        'User-Agent': 'CORS-Test-Script'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const corsHeader = res.headers['access-control-allow-origin'];
        const isAllowed = corsHeader === origin || corsHeader === '*';
        
        console.log(`🌐 Origin: ${origin}`);
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   CORS Header: ${corsHeader || 'No CORS header'}`);
        console.log(`   Allowed: ${isAllowed ? '✅' : '❌'}`);
        console.log(`   Response: ${data.substring(0, 100)}...`);
        console.log('');
        
        resolve({ origin, statusCode: res.statusCode, corsHeader, isAllowed });
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Error testing ${origin}:`, err.message);
      reject(err);
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Probando configuración de CORS...\n');
  
  for (const origin of testOrigins) {
    try {
      await testCORS(origin);
      // Pequeña pausa entre requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`❌ Error en test para ${origin}:`, error.message);
    }
  }
  
  console.log('✅ Pruebas de CORS completadas');
}

runTests();
