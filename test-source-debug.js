// Test para debuggear el problema del source
const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:3001';

async function testSourceDebug() {
  console.log('🧪 Probando diferentes formatos de source...');
  
  // Test 1: source en metadata (formato correcto)
  console.log('\n📤 Test 1: source en metadata');
  const test1 = {
    id: `test1-${Date.now()}`,
    name: 'Test1-Metadata',
    parentId: null,
    icon: 'Taskbar',
    color: 'text-blue-600',
    metadata: {
      source: 'taskbar',
      isMainFolder: true,
      isPublic: false
    }
  };

  try {
    const response1 = await fetch(`${BACKEND_URL}/api/folders/create`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(test1),
    });

    console.log('Status:', response1.status);
    if (response1.ok) {
      const result1 = await response1.json();
      console.log('✅ Test1 - Source en metadata:', result1.folder?.metadata?.source);
    } else {
      const error1 = await response1.json();
      console.log('❌ Test1 Error:', error1);
    }
  } catch (error) {
    console.log('❌ Test1 Network Error:', error.message);
  }

  // Test 2: source en nivel raíz
  console.log('\n📤 Test 2: source en nivel raíz');
  const test2 = {
    id: `test2-${Date.now()}`,
    name: 'Test2-Root',
    parentId: null,
    icon: 'Taskbar',
    color: 'text-blue-600',
    source: 'taskbar',
    metadata: {
      isMainFolder: true,
      isPublic: false
    }
  };

  try {
    const response2 = await fetch(`${BACKEND_URL}/api/folders/create`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(test2),
    });

    console.log('Status:', response2.status);
    if (response2.ok) {
      const result2 = await response2.json();
      console.log('✅ Test2 - Source en raíz:', result2.folder?.metadata?.source);
    } else {
      const error2 = await response2.json();
      console.log('❌ Test2 Error:', error2);
    }
  } catch (error) {
    console.log('❌ Test2 Network Error:', error.message);
  }
}

// Ejecutar tests
testSourceDebug();
