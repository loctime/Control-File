#!/usr/bin/env node

/**
 * Script para desplegar índices de Firestore
 * Uso: node scripts/deploy-firestore-indexes.js
 */

const { execSync } = require('child_process');
const path = require('path');

async function deployIndexes() {
  try {
    console.log('🚀 Desplegando índices de Firestore...');
    
    // Verificar que firebase CLI esté instalado
    try {
      execSync('firebase --version', { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ Firebase CLI no está instalado. Instálalo con: npm install -g firebase-tools');
      process.exit(1);
    }

    // Verificar que estemos autenticados
    try {
      execSync('firebase projects:list', { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ No estás autenticado con Firebase. Ejecuta: firebase login');
      process.exit(1);
    }

    // Desplegar índices
    console.log('📊 Desplegando índices desde firestore.indexes.json...');
    execSync('firebase deploy --only firestore:indexes', { 
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });

    console.log('✅ Índices desplegados correctamente');
    console.log('⏳ Los índices pueden tardar unos minutos en estar disponibles');

  } catch (error) {
    console.error('❌ Error desplegando índices:', error.message);
    process.exit(1);
  }
}

deployIndexes();
