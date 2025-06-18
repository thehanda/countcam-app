import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// Ensure Firebase Admin SDK is initialized only once
if (!getApps().length) {
  try {
    admin.initializeApp({
      // projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Not needed when running in GCP environment
      // credential: admin.credential.applicationDefault(), // Automatically inferred in GCP environments
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    // Throwing the error might be too disruptive if other parts of the app don't rely on admin db
    // Consider how to handle this if initialization fails.
  }
} else {
  console.log('Firebase Admin SDK already initialized.');
}

let dbAdminInstance: admin.firestore.Firestore;

try {
  dbAdminInstance = admin.firestore();
  console.log('Firebase Admin Firestore instance obtained successfully.');
} catch (error) {
  console.error('Error obtaining Firebase Admin Firestore instance:', error);
  // Fallback or rethrow, depending on how critical admin db is at startup
  // For now, let it be undefined and handle it in the API route if it fails
}


export const dbAdmin = dbAdminInstance;
