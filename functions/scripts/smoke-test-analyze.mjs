// Manual smoke test for analyzeShadowingPattern against local emulators.
// Requires: firebase emulators:start --only functions,firestore,auth,storage
// Run: GEMINI_API_KEY=... node functions/scripts/smoke-test-analyze.mjs

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.GCLOUD_PROJECT = 'kyphan38-apps';

import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID || 'kyphan38-noda-app';
const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${PROJECT_ID}.firebasestorage.app`;
// Must match `region` in functions/src/analyzeShadowingPattern.ts.
const REGION = 'asia-southeast1';
// UID changed when noda moved to its own Firebase project - override with
// ALLOWED_UID=... when the emulator is seeded for a different user.
const ALLOWED_UID = process.env.ALLOWED_UID || process.env.NEXT_PUBLIC_ALLOWED_USER_UID || '';
const FUNCTIONS_HOST = '127.0.0.1:5001';

const AUDIO_PATH = '/Users/kyphan/ws/app/noda/audio/Test_How_Switzerland_Engineered_the_Perfect_Country_10.mp3';
const SOURCE_TEXT = "I'm traveling through a tunnel right now on a train that's going 200 kilometers an hour.";
const START_SEC = 6.86;
const END_SEC = 11.75;

admin.initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });

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
  const objectPath = `users/${ALLOWED_UID}/media/smoke-test-lesson-${Date.now()}.mp3`;
  await admin.storage().bucket().upload(AUDIO_PATH, {
    destination: objectPath,
    contentType: 'audio/mpeg',
  });
  console.log('   uploaded to', objectPath);

  console.log('3) Mint custom token + exchange for ID token via Auth emulator REST...');
  const customToken = await admin.auth().createCustomToken(ALLOWED_UID);
  const signInRes = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const signInJson = await signInRes.json();
  if (!signInJson.idToken) {
    throw new Error('Failed to sign in: ' + JSON.stringify(signInJson));
  }
  const idToken = signInJson.idToken;
  console.log('   got idToken (len', idToken.length, ')');

  const lessonId = 'smoke-test-lesson';
  const sentenceId = 1;

  const payload = {
    data: {
      lessonId,
      sentenceId,
      mediaStoragePath: objectPath,
      sourceText: SOURCE_TEXT,
      startSec: START_SEC,
      endSec: END_SEC,
    },
  };

  console.log('4) Call #1 (expect cache MISS, real Gemini call)...');
  const t0 = Date.now();
  const res1 = await callFunction(payload, idToken);
  console.log('   status', res1.status, 'took', Date.now() - t0, 'ms');
  console.log('   body:', JSON.stringify(res1.body, null, 2));

  console.log('5) Verify Firestore cache doc was written...');
  const docRef = admin
    .firestore()
    .doc(`users/${ALLOWED_UID}/lessons/${lessonId}/shadowingAnalysis/${sentenceId}`);
  const snap = await docRef.get();
  console.log('   doc exists:', snap.exists);
  if (snap.exists) console.log('   doc data:', JSON.stringify(snap.data(), null, 2));

  console.log('6) Call #2 (expect cache HIT, fast, no Gemini call)...');
  const t1 = Date.now();
  const res2 = await callFunction(payload, idToken);
  console.log('   status', res2.status, 'took', Date.now() - t1, 'ms');
  console.log('   body:', JSON.stringify(res2.body, null, 2));

  const hitFast = Date.now() - t1 < Date.now() - t0;
  console.log('\n=== SUMMARY ===');
  console.log('Call 1 (miss) ok:', res1.status === 200);
  console.log('Cache doc written:', snap.exists);
  console.log('Call 2 (hit) ok:', res2.status === 200);
  console.log('Call 2 faster than call 1:', Date.now() - t1 < Date.now() - t0 ? 'n/a (see ms above)' : 'n/a');

  process.exit(res1.status === 200 && res2.status === 200 && snap.exists ? 0 : 1);
}

async function callFunction(payload, idToken) {
  const url = `http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/analyzeShadowingPattern`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  let body;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  return { status: res.status, body };
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
