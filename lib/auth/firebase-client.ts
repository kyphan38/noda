"use client";

import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import {
  Firestore,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
  getFirestore,
} from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";

function readFirebaseConfig(): FirebaseOptions {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_APP_ID.",
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId,
    storageBucket,
  };
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedFirestore: Firestore | null = null;
let cachedStorage: FirebaseStorage | null = null;
let persistenceInitPromise: Promise<void> | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  const config = readFirebaseConfig();
  cachedApp = getApps().length > 0 ? getApp() : initializeApp(config);
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseApp());
  return cachedAuth;
}

async function initFirestoreOfflinePersistence(db: Firestore): Promise<void> {
  if (typeof window === "undefined") return;
  if (persistenceInitPromise) return persistenceInitPromise;

  persistenceInitPromise = (async () => {
    try {
      await enableMultiTabIndexedDbPersistence(db);
      return;
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "failed-precondition") {
        try {
          await enableIndexedDbPersistence(db);
          return;
        } catch (fallbackErr) {
          const fallbackCode = (fallbackErr as { code?: string } | null)?.code;
          if (fallbackCode === "failed-precondition" || fallbackCode === "unimplemented") {
            return;
          }
          throw fallbackErr;
        }
      }
      if (code === "unimplemented") return;
      throw err;
    }
  })();

  return persistenceInitPromise;
}

export function getFirebaseFirestore(): Firestore {
  if (cachedFirestore) return cachedFirestore;
  cachedFirestore = getFirestore(getFirebaseApp());
  void initFirestoreOfflinePersistence(cachedFirestore);
  return cachedFirestore;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (cachedStorage) return cachedStorage;
  cachedStorage = getStorage(getFirebaseApp());
  return cachedStorage;
}
