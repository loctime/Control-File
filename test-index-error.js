// Script para generar error de índice y obtener enlace
const fetch = require('node-fetch');

async function testIndexError() {
  console.log('🧪 Probando consulta que requiere índice...');
  
  try {
    const response = await fetch('http://localhost:3003/api/files/list?parentId=null', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    });

    console.log('Status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Respuesta exitosa:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.log('❌ Error:', error);
    }
  } catch (error) {
    console.log('❌ Error de red:', error.message);
  }
}

// Ejecutar prueba
testIndexError();
