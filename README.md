<div align="center">
   <img width="auto" height="600" alt="RiddleRealm preview" src="preview.png" />
</div>

<p align="center">
   <img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white" alt="React 19" />
   <img src="https://img.shields.io/badge/Vite-6.4-646cff?logo=vite&logoColor=white" alt="Vite" />
   <img src="https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-ffca28?logo=firebase&logoColor=black" alt="Firebase" />
   <a href="https://www.linkedin.com/in/bismaya-jyoti-d-74692a328" target="_blank" rel="noopener noreferrer">
      <img src="https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin&logoColor=white" alt="LinkedIn" />
   </a>
</p>

## About

RiddleRealm is a React + Vite experience where players tackle daily riddles, unlock AI-generated hints from Gemini, and compete on a Firebase-backed leaderboard.

## Quick Start

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Firebase + EmailJS config (OTP creds only matter if you re-enable OTP via `VITE_ENABLE_OTP=true`). Set `GEMINI_API_KEY` in your server environment (e.g., Vercel project settings or a local `.env` read by `vercel dev`/`server/index.js`) so only backend code can see it. If you host the Gemini proxy elsewhere, point `VITE_GEMINI_PROXY_ENDPOINT` at that URL.
3. Launch the dev server: `npm run dev`

### Optional: seed Firestore with demo data

1. Download a Firebase service account key for the target project and note the path, e.g. `./service-account.json`.
2. Run `FIREBASE_SERVICE_ACCOUNT=./service-account.json npm run seed:firestore` (you can also inline the JSON string into the env var).
3. The script provisions:
   - Three user profiles (approved admin, approved player, pending player)
   - A sample `dailyRiddle/current` document
   - Two example submissions (one approved, one pending)

You can re-run the seed command safely; it merges documents so local tweaks stay intact.

## Core Features

- Daily riddles with Gemini fallback to curated offline content
- Progressive hint ladder with playful roasts
- Firebase authentication, profile tracking, and leaderboard scoring
- Admin panel for managing riddles and reviewing player submissions
- Optional OTP-protected login with email-delivered confirmation codes (enable via `VITE_ENABLE_OTP=true`)
- Admin-gated player onboarding: new accounts require approval in the dashboard before they can play

## Account Approval Flow

When someone signs up, their profile starts in a **pending** state. Admin emails listed in `VITE_FIREBASE_ADMIN_EMAILS` skip this gate automatically.

- Pending players see a holding screen and cannot access gameplay, submissions, or data.
- Admins get a queue inside the Admin tab that shows who is waiting; approving a player flips them to **approved** instantly.
- Repeated sign-up attempts do not create duplicate requests—the original record stays pending until approved.

## Environment Variables

**Server-only (API routes, `/api/gemini`, `server/index.js`)**

```
GEMINI_API_KEY=
```

**Client-side (Vite)**

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_ADMIN_EMAILS=

VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_PUBLIC_KEY=
VITE_ENABLE_OTP=

# optional override, defaults to /api/gemini
VITE_GEMINI_PROXY_ENDPOINT=
```