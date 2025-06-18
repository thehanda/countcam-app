
import admin from 'firebase-admin';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { type App, getApps, initializeApp } from 'firebase-admin/app';

let adminApp: App | undefined = undefined;
let dbAdminInstance: Firestore | undefined = undefined;

// In GCP environments like App Hosting, GCLOUD_PROJECT is automatically set.
// For local dev, NEXT_PUBLIC_FIREBASE_PROJECT_ID from .env can be used.
const detectedProjectId = process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

console.log("Firebase Admin SDK Initialization (firebaseAdmin.ts) Starting...");
console.log(`  GCLOUD_PROJECT (from env): ${process.env.GCLOUD_PROJECT}`);
console.log(`  NEXT_PUBLIC_FIREBASE_PROJECT_ID (from env): ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
console.log(`  Using Project ID for Admin SDK: ${detectedProjectId}`);

if (!detectedProjectId) {
    console.error("CRITICAL (firebaseAdmin.ts): Project ID could not be determined. Admin SDK cannot initialize. Ensure GCLOUD_PROJECT (on GCP) or NEXT_PUBLIC_FIREBASE_PROJECT_ID (for local dev) is available.");
} else {
    if (getApps().length === 0) {
        console.log("No Firebase Admin app initialized yet. Attempting initialization...");
        try {
            // Attempt to initialize with explicit projectId first
            console.log(`Attempting admin.initializeApp({ projectId: "${detectedProjectId}" })`);
            adminApp = initializeApp({ projectId: detectedProjectId });
            console.log('Firebase Admin SDK initialized successfully with explicit projectId. Admin App Project ID:', adminApp.options.projectId);
        } catch (e: any) {
            console.error(`CRITICAL (firebaseAdmin.ts): Error initializing Admin SDK with explicit projectId ("${detectedProjectId}"):`, e.message);
            console.error('Admin SDK Explicit Init Error Stack:', e.stack);
            // Fallback to default initialization (no args)
            console.log("Attempting fallback to admin.initializeApp() (no arguments)...");
            try {
                adminApp = initializeApp();
                console.log('Firebase Admin SDK initialized successfully using fallback default credentials. Admin App Project ID:', adminApp.options.projectId);
            } catch (e2: any) {
                console.error('CRITICAL (firebaseAdmin.ts): Error initializing Admin SDK with fallback default credentials:', e2.message);
                console.error('Admin SDK Fallback Initialization Error Stack:', e2.stack);
            }
        }
    } else {
        console.log("Firebase Admin app already initialized. Getting existing app.");
        adminApp = getApps()[0]!;
        if (adminApp) {
          console.log('Using existing Firebase Admin app. Admin App Project ID:', adminApp.options.projectId);
        } else {
          console.error("CRITICAL (firebaseAdmin.ts): getApps() reported existing apps, but could not retrieve one.");
        }
    }

    if (adminApp) {
        try {
            dbAdminInstance = getFirestore(adminApp);
            console.log('Firebase Admin Firestore instance obtained successfully (firebaseAdmin.ts).');
        } catch (e: any) {
            console.error('CRITICAL (firebaseAdmin.ts): Error obtaining Firebase Admin Firestore instance:', e.message);
            console.error('Admin Firestore Instance Error Stack:', e.stack);
        }
    } else {
        console.error("CRITICAL (firebaseAdmin.ts): Firebase Admin App (adminApp) could not be initialized or retrieved. Firestore instance cannot be obtained.");
    }
}

export const dbAdmin = dbAdminInstance;
