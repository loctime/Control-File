// Script para probar solicitudes OPTIONS (preflight)
const https = require('https');

const testOrigins = [
  'https://files.controldoc.app',
  'https://controldoc.app'
];

const backendUrl = 'https://controlfile.onrender.com';

async function testOPTIONS(origin, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'controlfile.onrender.com',
      port: 443,
      path: path,
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
        'User-Agent': 'OPTIONS-Test-Script'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const corsHeader = res.headers['access-control-allow-origin'];
        const allowMethods = res.headers['access-control-allow-methods'];
        const allowHeaders = res.headers['access-control-allow-headers'];
        
        console.log(`🌐 OPTIONS ${path} - Origin: ${origin}`);
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   CORS Header: ${corsHeader || 'No CORS header'}`);
        console.log(`   Allow Methods: ${allowMethods || 'No methods header'}`);
        console.log(`   Allow Headers: ${allowHeaders || 'No headers header'}`);
        console.log(`   Success: ${res.statusCode === 200 ? '✅' : '❌'}`);
        console.log('');
        
        resolve({ 
          origin, 
          path,
          statusCode: res.statusCode, 
          corsHeader, 
          allowMethods,
          allowHeaders,
          success: res.statusCode === 200 
        });
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Error testing OPTIONS ${path} for ${origin}:`, err.message);
      reject(err);
    });

    req.end();
  });
}

async function runOPTIONSTests() {
  console.log('🧪 Probando solicitudes OPTIONS (preflight)...\n');
  
  const paths = [
    '/api/uploads/presign',
    '/api/files/presign-get',
    '/api/shares/create'
  ];
  
  for (const origin of testOrigins) {
    for (const path of paths) {
      try {
        await testOPTIONS(origin, path);
        // Pequeña pausa entre requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`❌ Error en test OPTIONS para ${origin}${path}:`, error.message);
      }
    }
  }
  
  console.log('✅ Pruebas de OPTIONS completadas');
}

runOPTIONSTests();
