# Cosift — Product Requirement Doc

## Original Problem Statement
Mobile-first PWA called **Cosift** — an async social reading experience where people read PDFs
together, highlight meaningful sections, add personal thoughts, and progressively unlock other
readers' insights as they reach the relevant pages. Calm, reflective, intimate. Not noisy social
media. **Tagline:** _Sift meaning from what you read, together._

## Architecture (tasks done)
- React (CRA) frontend, mobile-first PWA shell (`max-w-md` centered)
- FastAPI backend, MongoDB persistence
- Auth: Emergent-managed Google OAuth (full users) + anonymous sessions (invite-link joiners),
  both yielding a `session_token` accepted via httpOnly cookie OR `Authorization: Bearer` header
- PDF reader via `react-pdf` + `pdfjs-dist`
- Calm design: Cormorant Garamond + Manrope, warm-paper palette, terracotta accent
- PWA manifest + minimal service worker (offline shell only; PDFs deferred per user choice)

## User Personas
1. **Circle Host** — wants to read a book together with a small group. Creates a circle, uploads a
   PDF, shares an invite link. Authenticated via Google.
2. **Invite Joiner** — receives the link. Enters a display name. Reads immediately. Optionally
   upgrades to Google account later.
3. **Solo Reader** — uses Cosift as a quiet personal margin notebook. Authenticated.

## Core Requirements (static)
- PDF-first reading. Highlight → optional thought. Thread replies on highlights. Vocabulary bank.
- **Unlocking mechanic**: a viewer only sees highlights/thoughts/threads on pages
  `page <= max_page_reached`. `max_page_reached` is monotonic per user/book.
- Mobile-first PWA, installable, calm typography-first UI, no purple gradients, no dark-on-dark.

## What's been implemented (2026-05-16)
### Backend (`/app/backend/server.py`)
- Auth: `POST /api/auth/session`, `POST /api/auth/anonymous`, `GET /api/auth/me`, `POST /api/auth/logout`
- Circles: `POST/GET /api/circles`, `GET /api/circles/{id}`
- Books: `POST /api/books` (PDF multipart upload), `GET /api/books/solo`, `GET /api/books/{id}`,
  `PUT /api/books/{id}/total-pages`, `GET /api/files/{file_id}` (PDF serve)
- Progress: `PUT /api/progress` (max_page_reached monotonic)
- Highlights / Thoughts / Threads: `POST /api/highlights`, `GET /api/books/{id}/highlights`
  (unlocking-filtered), `GET /api/books/{id}/locked-count`, `POST|GET /api/highlights/{id}/threads`
- Vocabulary: `POST|GET /api/vocabulary`
- Invites: `POST /api/circles/{id}/invite`, `GET /api/invites/{code}`, `POST /api/invites/{code}/join`
- Feeds: `GET /api/turns`, `GET /api/my-thoughts`, `GET /api/saved-insights`

### Frontend
- Landing (`/`), Auth Callback (hash-based), Join via Link (`/join`, `/join/:code`),
  Create Circle wizard (`/create-circle`), Create Solo (`/create-solo`)
- App shell with bottom tabs: Reads (`/app/reads`), Turns (`/app/turns`), Personal (`/app/personal`)
- Reader (`/read/:bookId`) with PDF rendering, text-selection toolbar, thought sheet, vocab sheet,
  threaded highlight sheet, page nav, activity banner, locked-insight card

### Testing
- 20/20 pytest cases pass on backend (`/app/backend/tests/test_cosift_api.py`)
- Frontend smoke: anonymous invite-join flow validated

## Prioritized Backlog
### P0 (next session)
- Real-time activity via WebSocket / SSE (currently in-app on page change)
- Solo & Circle completion analytics screens (skeleton missing — backend has the data)
- Empty-but-joined circle visibility in Reads tab

### P1
- Offline PDF caching (IndexedDB) and background sync of highlights when reconnected
- Push notifications (architecture-ready: service worker scaffolded)
- Anonymous → Google account merge flow (preserve thoughts/highlights on upgrade)
- Multi-book per circle UX (today one circle = one book in the wizard, model supports many)

### P2
- AI-assisted thought prompts, smart highlight recommendations
- Reading-speed / focus-score analytics
- Reactions / lightweight social signals (kept minimal by design)

## Open Items / Known Limitations
- PWA service worker caches the app shell only — PDFs are served fresh (per user choice for v1).
- Reader uses cdnjs PDF.js worker URL; consider self-hosting for offline robustness.
