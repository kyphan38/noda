/**
 * Cleans up after a lesson doc is deleted (Delete forever, "Remove all" in the
 * trash, or any other path): its uploaded media, the analysis-audio FLAC copy, and
 * the `shadowingAnalysis` subcollection. Firestore does not delete subcollections
 * with their parent, and clients cannot delete `analysis-audio/` (Storage rules),
 * so this has to run on the server.
 *
 * Moving a lesson to the trash only sets `isTrashed`; nothing is removed until the
 * doc itself is deleted.
 */

import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

import { lessonStoragePaths } from "./lib/lessonCleanup";

/** Keep in sync with NODA_DB_ID in analyzeShadowingPattern.ts and lib/firebase-db-id.ts. */
const NODA_DB_ID = "(default)";

export const onLessonDeleted = onDocumentDeleted(
  {
    document: "users/{uid}/lessons/{lessonId}",
    database: NODA_DB_ID,
    // Same region as the Firestore database (asia-southeast1).
    region: "asia-southeast1",
  },
  async (event) => {
    const { uid, lessonId } = event.params;
    const data = event.data?.data() ?? {};
    const bucket = admin.storage().bucket();

    for (const path of lessonStoragePaths(uid, data)) {
      try {
        await bucket.file(path).delete({ ignoreNotFound: true });
      } catch (e) {
        console.error(`Could not delete ${path} for lesson ${lessonId}:`, (e as Error).message);
      }
    }

    // The parent doc is already gone; this removes what is left under it.
    const lessonRef = getFirestore(admin.app(), NODA_DB_ID).doc(`users/${uid}/lessons/${lessonId}`);
    await getFirestore(admin.app(), NODA_DB_ID).recursiveDelete(lessonRef);
  }
);
