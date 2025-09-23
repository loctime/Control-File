#!/usr/bin/env node

/**
 * Script para probar la configuración de dominios
 * Uso: node scripts/test-domain.js
 */

const { getCurrentDomainConfig, isDomainAuthorized, getFirebaseConfig } = require('../lib/domain-config');

function testDomainConfig() {
  console.log('🧪 Probando configuración de dominios...\n');

  try {
    // Simular diferentes dominios
    const testDomains = [
      'localhost',
      'files.controldoc.app',
      'test.controldoc.app',
      'unknown-domain.com'
    ];

    testDomains.forEach(domain => {
      console.log(`\n🌐 Probando dominio: ${domain}`);
      
      // Simular window.location.hostname
      global.window = {
        location: {
          hostname: domain
        }
      };

      try {
        const config = getCurrentDomainConfig();
        const authorized = isDomainAuthorized();
        
        console.log(`  ✅ Configuración encontrada: ${config ? 'Sí' : 'No'}`);
        console.log(`  ✅ Dominio autorizado: ${authorized ? 'Sí' : 'No'}`);
        
        if (config) {
          console.log(`  📝 Configuración Firebase:`);
          console.log(`     - authDomain: ${config.firebaseConfig.authDomain}`);
          console.log(`     - projectId: ${config.firebaseConfig.projectId}`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    });

    console.log('\n✅ Prueba completada');

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testDomainConfig();
