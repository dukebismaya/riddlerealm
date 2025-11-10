import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

type FirebaseConfig = {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  storageBucket: string | undefined;
  messagingSenderId: string | undefined;
  appId: string | undefined;
};

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingConfigKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfigKeys.length) {
  console.warn(
    `Missing Firebase config values for: ${missingConfigKeys.join(', ')}. Authentication features will be limited until these are provided.`
  );
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;

if (missingConfigKeys.length === 0) {
  const options = firebaseConfig as FirebaseOptions;
  app = getApps().length ? getApp() : initializeApp(options);
  authInstance = getAuth(app);
  firestoreInstance = getFirestore(app);
}

export const firebaseApp = app;
export const auth = authInstance;
export const db = firestoreInstance;
export const isFirebaseConfigured = missingConfigKeys.length === 0;
export const missingFirebaseConfigKeys = missingConfigKeys;
