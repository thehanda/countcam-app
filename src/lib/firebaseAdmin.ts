import admin from 'firebase-admin';
import { getApps, initializeApp as initializeAdminApp, type App as AdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, type Firestore as AdminFirestore } from 'firebase-admin/firestore';

let adminApp: AdminApp | undefined = undefined;
let dbAdminInstance: AdminFirestore | undefined = undefined;

console.log("Attempting to initialize Firebase Admin SDK (firebaseAdmin.ts)...");

if (!getApps().length) {
  try {
    // In App Hosting (GCP environment), initializeApp() without arguments
    // should use the application default credentials.
    adminApp = initializeAdminApp();
    console.log('Firebase Admin SDK initialized successfully using default credentials. Project ID from Admin SDK:', adminApp.options.projectId);
  } catch (error: any) {
    console.error('CRITICAL: Error initializing Firebase Admin SDK (firebaseAdmin.ts):', error.message);
    console.error('Admin SDK Initialization Error Stack:', error.stack);
    // If initialization fails, dbAdminInstance will remain undefined.
  }
} else {
  adminApp = getApps()[0]!; // Use the already initialized app
  console.log('Firebase Admin SDK already initialized. Using existing app. Project ID from Admin SDK:', adminApp.options.projectId);
}

if (adminApp) {
  try {
    dbAdminInstance = getAdminFirestore(adminApp);
    console.log('Firebase Admin Firestore instance obtained successfully (firebaseAdmin.ts).');
  } catch (error: any) {
    console.error('CRITICAL: Error obtaining Firebase Admin Firestore instance (firebaseAdmin.ts):', error.message);
    console.error('Admin Firestore Instance Error Stack:', error.stack);
    // If obtaining Firestore fails, dbAdminInstance will remain undefined.
  }
} else {
  console.error("CRITICAL: Firebase Admin App (adminApp) is not available in firebaseAdmin.ts. Firestore instance cannot be obtained.");
}

export const dbAdmin = dbAdminInstance; // This might be undefined if init failed
