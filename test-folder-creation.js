// Script de prueba para verificar la creación de carpetas
const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:3001';

async function testFolderCreation() {
  console.log('🧪 Probando creación de carpeta con source en metadata...');
  
  // Simular el request que hace ControlBio
  const testData = {
    id: `test-main-${Date.now()}`,
    name: 'TestApp',
    parentId: null,
    icon: 'Taskbar',
    color: 'text-blue-600',
    metadata: {
      source: 'taskbar', // ← Esto debería respetarse
      isMainFolder: true,
      isPublic: false
    }
  };

  console.log('📤 Enviando datos:', JSON.stringify(testData, null, 2));

  try {
    const response = await fetch(`${BACKEND_URL}/api/folders/create`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token', // Token de prueba
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    console.log('📥 Respuesta status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Respuesta exitosa:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.json();
      console.log('❌ Error:', JSON.stringify(error, null, 2));
    }
  } catch (error) {
    console.log('❌ Error de red:', error.message);
  }
}

// Ejecutar prueba
testFolderCreation();
