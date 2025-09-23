#!/usr/bin/env node

/**
 * Reconciliation script for Mini-OneDrive
 * This script verifies and corrects user quotas by comparing B2 storage with Firestore records
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

// Initialize Firebase Admin
const serviceAccount = require('../service-account-key.json');

if (!serviceAccount) {
  console.error('Service account key not found. Please create service-account-key.json');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// Initialize B2 S3 client
const s3Client = new S3Client({
  region: 'us-west-004',
  endpoint: process.env.B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME;

async function reconcileUserQuota(userId) {
  console.log(`\n🔍 Reconciling quota for user: ${userId}`);
  
  try {
    // Get user document
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log(`❌ User ${userId} not found in Firestore`);
      return;
    }
    
    const userData = userDoc.data();
    console.log(`📊 Current quota: ${formatBytes(userData.usedBytes)} / ${formatBytes(userData.planQuotaBytes)}`);
    
    // List all objects for this user in B2
    const objects = await listUserObjects(userId);
    const actualUsedBytes = objects.reduce((total, obj) => total + (obj.Size || 0), 0);
    
    console.log(`📁 Found ${objects.length} files in B2`);
    console.log(`💾 Actual storage used: ${formatBytes(actualUsedBytes)}`);
    
    // Compare with Firestore
    const difference = actualUsedBytes - userData.usedBytes;
    
    if (Math.abs(difference) > 1024) { // 1KB threshold
      console.log(`⚠️  Discrepancy detected: ${formatBytes(difference)}`);
      
      // Update user quota
      await userRef.update({
        usedBytes: actualUsedBytes,
      });
      
      console.log(`✅ Updated user quota to ${formatBytes(actualUsedBytes)}`);
    } else {
      console.log(`✅ Quota is accurate (difference: ${formatBytes(difference)})`);
    }
    
    // Clean up expired upload sessions
    await cleanupExpiredSessions(userId);
    
  } catch (error) {
    console.error(`❌ Error reconciling user ${userId}:`, error);
  }
}

async function listUserObjects(userId) {
  const objects = [];
  let continuationToken = null;
  
  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `${userId}/`,
      ContinuationToken: continuationToken,
    });
    
    const response = await s3Client.send(command);
    
    if (response.Contents) {
      objects.push(...response.Contents);
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  return objects;
}

async function cleanupExpiredSessions(userId) {
  console.log(`🧹 Cleaning up expired upload sessions for user: ${userId}`);
  
  const now = new Date();
  const sessionsRef = db.collection('uploadSessions');
  const expiredSessions = await sessionsRef
    .where('uid', '==', userId)
    .where('expiresAt', '<', now)
    .get();
  
  if (expiredSessions.empty) {
    console.log(`✅ No expired sessions found`);
    return;
  }
  
  let totalPendingBytes = 0;
  
  for (const doc of expiredSessions.docs) {
    const sessionData = doc.data();
    if (sessionData.status === 'pending') {
      totalPendingBytes += sessionData.size || 0;
    }
    await doc.ref.delete();
  }
  
  if (totalPendingBytes > 0) {
    // Update user's pending bytes
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      pendingBytes: db.FieldValue.increment(-totalPendingBytes),
    });
    
    console.log(`✅ Cleaned up ${expiredSessions.size} expired sessions`);
    console.log(`📉 Reduced pending bytes by ${formatBytes(totalPendingBytes)}`);
  }
}

async function reconcileAllUsers() {
  console.log('🚀 Starting quota reconciliation for all users...');
  
  try {
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.get();
    
    console.log(`👥 Found ${usersSnapshot.size} users to reconcile`);
    
    for (const userDoc of usersSnapshot.docs) {
      await reconcileUserQuota(userDoc.id);
    }
    
    console.log('\n✅ Reconciliation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during reconciliation:', error);
    process.exit(1);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node reconcile.js [userId]');
    console.log('  If userId is provided, reconciles only that user');
    console.log('  If no userId is provided, reconciles all users');
    process.exit(1);
  }
  
  const userId = args[0];
  
  if (userId === 'all') {
    await reconcileAllUsers();
  } else {
    await reconcileUserQuota(userId);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Reconciliation interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Reconciliation terminated');
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  reconcileUserQuota,
  reconcileAllUsers,
  cleanupExpiredSessions,
};
