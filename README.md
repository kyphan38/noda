# noda

noda is a static-export Next.js app focused on dictation, listening, shadowing, and flashcards.

## Environment

Create `.env.local` from `.env.example` and set:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_ALLOWED_USER_UID` (recommended) or `NEXT_PUBLIC_ALLOWED_EMAIL`
- `BASE_PATH` when deploying under a subpath (for example GitHub Pages)

Important: because noda uses static export, `NEXT_PUBLIC_*` values are baked in at build time.
Any change requires a rebuild/redeploy.

## Security model

- noda uses client-side Firebase auth gating.
- Only allowlisted user can render app content.
- Since this is static export (`output: "export"`), there is no server middleware enforcement in noda.
