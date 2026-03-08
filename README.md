# Sheets — Real-time Collaborative Spreadsheet

A lightweight, real-time collaborative spreadsheet built with **Next.js 16 App Router**, **Firebase** (Auth + Firestore), and **Tailwind CSS v4**.

Live URL: _add after Vercel deployment_

---

## Quick Start

```bash
# 1. Clone and install
npm install

# 2. Copy env template and fill in your Firebase project details
cp .env.local.example .env.local

# 3. Deploy Firestore rules
firebase deploy --only firestore:rules

# 4. Run
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | e.g. `project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Your Firestore project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | e.g. `project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID |

---

## Architecture

### State & data flow

```
Browser ──write──> Firestore ──onSnapshot──> all open sessions
                     (per-cell documents)
```

Each cell is its own Firestore document (`/documents/{docId}/cells/{A1}`). Writes are **debounced 400 ms** to avoid per-keystroke round trips. The write-state indicator (`saving → saved → idle`) reflects the debounce lifecycle.

**Contention strategy — last-writer-wins per cell.** This is intentional. Cells are independent; granular last-write-wins is the correct tradeoff at this scale. A CRDT (e.g. Yjs) would add complexity without meaningful benefit until cells need sub-character merging.

**Optimistic updates:** Before the Firestore write, the local computed map is recalculated immediately so the user never waits for the round trip to see formula results.

### Formula engine (`lib/formula.ts`)

A hand-rolled recursive-descent evaluator. Supported:

| Feature | Example |
|---|---|
| Arithmetic | `=A1*2 + B3/4` |
| Cell references | `=A1`, `=Z99` |
| Range | `A1:C3` |
| SUM | `=SUM(A1:A10)` |
| AVERAGE | `=AVERAGE(B1:B5)` |
| MIN / MAX | `=MIN(A1:C3)` |
| COUNT | `=COUNT(A1:A10)` |

**Why not a full parser?** An 80/20 decision — these functions cover the vast majority of real spreadsheet usage. Full expression trees (nested functions, string ops, `IF`) add significant parser complexity for marginal real-world gain in a collaborative prototype. Circular references are not detected; the evaluator runs up to 10 passes which is sufficient for acyclic dependency chains and degrades gracefully for circular refs (returns the previous pass value rather than crashing).

### Presence (`lib/presence.ts`)

Each user writes a presence document to `/documents/{docId}/presence/{uid}` with a server timestamp. A 30-second heartbeat keeps it alive. Stale entries (> 90 s old) are filtered client-side. No Realtime Database is needed; Firestore's `onSnapshot` provides sub-second latency on this small subcollection.

### Server / client boundary

Firebase must not initialise on the server (the SDK throws on an invalid/missing API key during `next build`). The solution: `ClientProviders.tsx` (a `'use client'` component) uses `next/dynamic` with `ssr: false` to load the actual auth + identity providers. This is the only place where `ssr: false` is needed, and it's isolated cleanly from the layout.

---

## Features

- **Document dashboard** — list, create, rename, delete spreadsheets
- **Real-time sync** — Firestore `onSnapshot` per-cell, debounced writes, write-state indicator
- **Formula engine** — SUM, AVERAGE, MIN, MAX, COUNT, cell refs, ranges, arithmetic
- **Presence** — live collaborator avatars + active-cell highlight per user
- **Identity** — Google sign-in or guest (anonymous auth + display name)
- **Cell formatting** — bold, italic, text colour, background colour
- **Keyboard navigation** — Arrow keys, Tab, Enter, Escape, F2
- **Column/row resize** — drag header borders
- **Column reorder** — drag column headers to reorder
- **Export** — one-click CSV download

---

## Project structure

```
app/
  page.tsx                  Dashboard route
  editor/[docId]/page.tsx   Editor route (server shell)
components/
  ClientProviders.tsx       SSR-safe Firebase bootstrap (dynamic ssr:false)
  ClientProvidersInner.tsx  Actual auth + identity providers
  Dashboard.tsx             Document list + CRUD
  Editor.tsx                Orchestrates grid, sync, presence, formatting
  FormulaBar.tsx            Cell reference + raw formula input
  Grid.tsx                  Spreadsheet grid (cells, headers, resize, reorder)
  IdentityGate.tsx          Auth wall (Google / guest modal)
  PresenceBar.tsx           Collaborator avatar list
  Toolbar.tsx               Formatting toolbar
context/
  AuthContext.tsx           Firebase auth state + sign-in methods
lib/
  firebase.ts               Firebase app/auth/db singleton
  firestore.ts              Firestore read/write helpers
  formula.ts                Formula parser + evaluator
  presence.ts               Presence upsert/subscribe
  types.ts                  Shared TypeScript types
firestore.rules             Firestore security rules
```
