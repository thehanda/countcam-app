
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app: FirebaseApp;
let db: Firestore;

if (!getApps().length) {
  try {
    console.log("Initializing Firebase app with config:", {
        projectId: firebaseConfig.projectId, // Log only non-sensitive parts
        authDomain: firebaseConfig.authDomain
    });
    app = initializeApp(firebaseConfig);
    console.log("Firebase app initialized successfully.");
  } catch (e) {
    console.error("Error initializing Firebase app:", e);
    throw e; // Re-throw error to make it visible
  }
} else {
  app = getApp();
  console.log("Firebase app already initialized.");
}

try {
  db = getFirestore(app);
  console.log("Firestore instance obtained successfully.");
  if (!firebaseConfig.projectId) {
    console.warn("Firebase projectId is not configured in environment variables. Firestore might not work correctly.");
  }
} catch (e) {
  console.error("Error obtaining Firestore instance:", e);
  // If db initialization fails, we assign a placeholder or handle it to prevent app crash
  // For now, re-throwing might be too disruptive if other parts of app don't use db
  // db = {} as Firestore; // Or some other fallback
  console.error("Firestore could not be initialized. Any operations requiring Firestore will fail.");
  // throw e; // Optionally re-throw if Firestore is absolutely critical for app to start
}

export { app, db };
