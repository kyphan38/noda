/**
 * Cloud Functions entry point.
 *
 * See /Users/kyphan/.claude/plans/ok-v-y-b-y-gi-delegated-garden.md for the
 * full staged plan.
 */

import { getApps, initializeApp } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp();
}

export { analyzeShadowingPattern } from "./analyzeShadowingPattern";
export { onLessonDeleted } from "./onLessonDeleted";
