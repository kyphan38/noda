/**
 * Cloud Functions entry point.
 *
 * See /Users/kyphan/.claude/plans/ok-v-y-b-y-gi-delegated-garden.md for the
 * full staged plan.
 */

import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export { analyzeShadowingPattern } from "./analyzeShadowingPattern";
