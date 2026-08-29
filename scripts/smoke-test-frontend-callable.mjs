// Stage 4 verify - exercises the exact client-SDK wiring added in
// lib/auth/firebase-client.ts (getFirebaseFunctions) + lib/shadowingAnalysis.ts
// (requestShadowingAnalysis / httpsCallable), against local emulators.
// Requires: firebase emulators:start --only functions,firestore,auth,storage

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithCustomToken } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { createRequire } from 'module';

// firebase-admin only lives in functions/node_modules (server-only dep); resolve it from there.
const functionsRequire = createRequire('/Users/kyphan/ws/app/noda/functions/package.json');
const admin = functionsRequire('firebase-admin');

const PROJECT_ID = 'kyphan38-apps';
const REGION = 'us-central1';
const ALLOWED_UID = 'yjzds6g7Y6VjmwtgW4QTnUqaX0F2';
const FUNCTION_NAME = 'analyzeShadowingPattern'; // must match SHADOWING_ANALYSIS_FUNCTION_NAME

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.GCLOUD_PROJECT = PROJECT_ID;

admin.initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.firebasestorage.app` });

const AUDIO_PATH =
  '/Users/kyphan/ws/app/noda/audio/Test_How_Switzerland_Engineered_the_Perfect_Country_10.mp3';
const SOURCE_TEXT = "I'm traveling through a tunnel right now on a train that's going 200 kilometers an hour.";
const START_SEC = 6.86;
const END_SEC = 11.75;

async function main() {
  console.log('1) Ensure allowlisted user exists in Auth emulator...');
  try {
    await admin.auth().getUser(ALLOWED_UID);
    console.log('   user already exists');
  } catch {
    await admin.auth().createUser({ uid: ALLOWED_UID, email: 'smoke-test@example.com' });
    console.log('   created user', ALLOWED_UID);
  }

  console.log('2) Upload test audio to Storage emulator...');
  const lessonId = `frontend-smoke-${Date.now()}`;
  const objectPath = `users/${ALLOWED_UID}/media/${lessonId}.mp3`;
  await admin.storage().bucket().upload(AUDIO_PATH, {
    destination: objectPath,
    contentType: 'audio/mpeg',
  });
  console.log('   uploaded to', objectPath);

  console.log('3) Mint custom token for the client SDK...');
  const customToken = await admin.auth().createCustomToken(ALLOWED_UID);

  console.log('4) Init client SDK (firebase/app, firebase/auth, firebase/functions)...');
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake-api-key' });
  const clientAuth = getAuth(app);
  connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const functions = getFunctions(app, REGION);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);

  console.log('5) Sign in with custom token (real Auth SDK sign-in flow)...');
  const cred = await signInWithCustomToken(clientAuth, customToken);
  console.log('   signed in as', cred.user.uid);

  console.log('6) Call requestShadowingAnalysis wiring via httpsCallable (Call #1, expect cache MISS)...');
  const callable = httpsCallable(functions, FUNCTION_NAME);
  const t0 = Date.now();
  const res1 = await callable({
    lessonId,
    sentenceId: 1,
    startSec: START_SEC,
    endSec: END_SEC,
    mediaStoragePath: objectPath,
    sourceText: SOURCE_TEXT,
  });
  console.log('   took', Date.now() - t0, 'ms');
  console.log('   result:', JSON.stringify(res1.data, null, 2));

  console.log('7) Call #2 (expect cache HIT, fast)...');
  const t1 = Date.now();
  const res2 = await callable({
    lessonId,
    sentenceId: 1,
    startSec: START_SEC,
    endSec: END_SEC,
    mediaStoragePath: objectPath,
    sourceText: SOURCE_TEXT,
  });
  const dt2 = Date.now() - t1;
  console.log('   took', dt2, 'ms');
  console.log('   result:', JSON.stringify(res2.data, null, 2));

  const dt1 = t1 - t0;
  console.log('\n=== SUMMARY ===');
  console.log('Call 1 (miss) has analysis:', !!res1.data?.analysis, `took ${dt1}ms`);
  console.log('Call 2 (hit) has analysis:', !!res2.data?.analysis, 'createdAt present:', !!res2.data?.createdAt, `took ${dt2}ms`);
  console.log('Call 2 faster than call 1:', dt2 < dt1);
  process.exit(0);
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
