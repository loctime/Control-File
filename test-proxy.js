// Script para probar el proxy de subida
const https = require('https');
const FormData = require('form-data');
const fs = require('fs');

async function testProxyUpload() {
  console.log('🧪 Probando proxy de subida...\n');
  
  // Crear un archivo de prueba
  const testContent = 'Este es un archivo de prueba para el proxy de subida';
  fs.writeFileSync('test-proxy.txt', testContent);
  
  // Crear FormData
  const form = new FormData();
  form.append('file', fs.createReadStream('test-proxy.txt'));
  form.append('sessionId', 'test-session-123');
  
  // Headers necesarios
  const headers = {
    ...form.getHeaders(),
    'Authorization': 'Bearer test-token'
  };
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'files.controldoc.app',
      port: 443,
      path: '/api/uploads/proxy-upload',
      method: 'POST',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`🌐 Proxy Upload Test`);
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Response: ${data.substring(0, 200)}...`);
        console.log(`   Success: ${res.statusCode === 200 ? '✅' : '❌'}`);
        console.log('');
        
        // Limpiar archivo de prueba
        fs.unlinkSync('test-proxy.txt');
        
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Error testing proxy upload:`, err.message);
      // Limpiar archivo de prueba
      if (fs.existsSync('test-proxy.txt')) {
        fs.unlinkSync('test-proxy.txt');
      }
      reject(err);
    });

    // Enviar el FormData
    form.pipe(req);
  });
}

async function runProxyTest() {
  try {
    await testProxyUpload();
    console.log('✅ Prueba de proxy completada');
  } catch (error) {
    console.log('❌ Error en prueba de proxy:', error.message);
  }
}

runProxyTest();
