# noda

noda is a static-export Next.js app focused on dictation, listening, shadowing, and flashcards.

## Environment

Create `.env.local` from `.env.example` and set:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_ALLOWED_USER_UID` (recommended) or `NEXT_PUBLIC_ALLOWED_EMAIL`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (required - noda stores lesson media in Cloud Storage)
- `BASE_PATH` when deploying under a subpath (for example GitHub Pages)

## Firebase project

noda owns the Firebase project **`kyphan38-noda-app`** outright: `(default)`
Firestore database, its own Storage bucket, and the `analyzeShadowingPattern`
Cloud Function. It used to share `kyphan38-apps` with cogi and logi, where it
needed a named `noda-db` database - that is no longer the case. The move is
written up in [PLAN-project-split.md](PLAN-project-split.md).

The database id lives in two places that must stay in sync, because `functions/`
is a separate package and cannot import from `lib/`:
`lib/firebase-db-id.ts` and `functions/src/analyzeShadowingPattern.ts`.

## Deploy

The app is deployed on **Vercel** as a static export, at
<https://noda.kyphan38.com>. `NEXT_PUBLIC_*` values are baked in at build time,
so changing any of them in the Vercel dashboard requires a **redeploy**, not
just a restart. Every hostname that serves the app must also be listed under
Firebase Console -> Authentication -> Settings -> Authorized domains, or Google
sign-in fails with `auth/unauthorized-domain`.

Cloud Functions deploy separately with `npx firebase deploy --only functions`
and need the `GEMINI_API_KEY` and `ALLOWED_USER_UID` secrets set on the project
(`npx firebase functions:secrets:set <NAME>`); secrets do not follow a project
move.

Important: because noda uses static export, `NEXT_PUBLIC_*` values are baked in at build time.
Any change requires a rebuild/redeploy.

## Security model

- noda uses client-side Firebase auth gating.
- Only allowlisted user can render app content.
- Since this is static export (`output: "export"`), there is no server middleware enforcement in noda.
- **Authoritative enforcement** is [Firestore rules](firestore.rules) and [Storage rules](storage.rules): only `users/{userId}/...` where `request.auth.uid == userId`. After deploy, confirm once in **Firebase Console → Firestore → Rules → Rules Playground** (e.g. read as another `userId` → expect deny). 

## Motion

Short, opacity/transform only, following `ws/app/DESIGN.md` "Motion". Plan:
`PLAN-motion.md`. Shared classes sit in the Motion block of `app/globals.css`
(`fade-in`, `fade-out`, `rise`, `pop`, `breathe`, `is-leaving` for modals and
the toast), with `--ease-soft`. The last block there turns every animation
and transition off under `prefers-reduced-motion`.

- `lib/motion.ts` (`reducedMotion`) is covered by vitest; `hooks/usePresence.ts`
  keeps something mounted while it animates out.
- Mode content fades in over 240ms, modals over 180-220ms.
- Loading skeletons are still gray blocks that `breathe`, not a shimmer.
- `ToastLayer` keeps the last toast 200ms after it closes so it slides out;
  a leaving toast has no timer and takes no taps.
- Try it without Google sign-in: `npm run dev:e2e` (port 3010).
