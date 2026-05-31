# Cosift — Bugs Log

Track of known/reported bugs with status. Newest first.

---

## BUG-005: Reflection from post-action sheet creates a duplicate highlight
- **Reported**: 2026-05-30 (P0 fixes round)
- **Symptom**: After tapping **Highlight** then **Add Reflection**, the DB ends up with two highlight rows for the same passage — the original highlight + a second one with the reflection attached. Personal → Reflections shows both.
- **Root cause**: Backend had only `POST /api/highlights` (which creates a NEW highlight, optionally with a `thought`). It lacked an endpoint to attach a reflection to an existing highlight. The frontend post-action handler called `POST /api/highlights` again with `thought=<reflection>` → duplicate row.
- **Fix**:
  - Backend: added `POST /api/highlights/{highlight_id}/thoughts` that inserts only into `thoughts`, tying to the existing highlight.
  - Frontend: `saveReflectionOnExisting()` uses the new endpoint when the user is in the post-create flow. The "Save reflection" button branches on `postCreateHighlight` (existing highlight vs. fresh selection).
  - Frontend: `saveHighlight(withThought=true)` no longer auto-opens the post-create sheet (the user already added a reflection).
- **Files touched**: `/app/backend/server.py` (new endpoint near `reply_thread`); `/app/frontend/src/pages/Reader.jsx` (`saveReflectionOnExisting`, `saveVocabFromPost`, branched bottom-sheet save buttons, `saveHighlight` flow).
- **Status**: ✅ Fixed and verified end-to-end in-browser. Reproduction: drag-select text → Highlight → Add Reflection → fill thought → Save. Result: `GET /api/books/{id}/highlights` returns `count=1, thoughts=1`. Personal → Reflections shows the single nested reflection.
- **Why it didn't work the first time**: A second one-line bug masked the root fix — the "Add Reflection" post-action button cleared `postCreateHighlight` before opening the thought sheet, so when the Save button branched on `postCreateHighlight`, the reference was already gone. Removing the premature reset + branching the Save button = full fix.

---

## BUG-006: PDF text selection unreliable across browsers / touch / keyboard
- **Reported**: 2026-05-30 (P0 fixes round)
- **Symptom**: Users selecting text in the PDF often see no floating Highlight/Share toolbar — the action menu fails to appear in mobile Safari, on Playwright synthetic mouse events, and on keyboard selections (`Shift+Arrow`).
- **Root cause**: The Reader listened only to React `onMouseUp` / `onTouchEnd` on a container. Those handlers fire BEFORE the system commits the selection in some browsers, get swallowed by the native context menu on mobile, and never fire for keyboard-driven selections.
- **Fix**: Replaced with a `document.addEventListener("selectionchange")` listener (debounced at 120 ms) that:
  - Sets `selectionText` only if the anchor lives inside `.react-pdf__Page__textContent` (so toolbar doesn't pop on UI text).
  - Resets `selectionText` only when no sheets are open (doesn't dismiss the user mid-edit).
  - Backed up by the existing `onMouseUp`/`onTouchEnd` for an immediate re-check.
- **Files touched**: `/app/frontend/src/pages/Reader.jsx`.
- **Status**: ✅ Fixed.

---

## BUG-002: Reader crashes when opening a book — "Failed to fetch dynamically imported module"
- **Reported**: 2026-05-16 (user screenshot at `/read/bk_ac7787c0c9c6`)
- **Symptom**: Uncaught `TypeError: Failed to fetch dynamically imported module: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.296/pdf.worker.min.mjs`
- **Root cause**: `react-pdf@10.4.1` bundles `pdfjs-dist@5.4.296` internally, but cdnjs does not publish a worker file at that exact patch version. The worker URL was templated from `pdfjs.version`, so it pointed to a non-existent file → dynamic import fails → the whole Reader screen crashes.
- **Fix**: Copy the bundled worker from `react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs` into `/app/frontend/public/pdf.worker.min.mjs` and point `pdfjs.GlobalWorkerOptions.workerSrc` to `/pdf.worker.min.mjs`. This guarantees the worker version matches the runtime pdfjs version and removes the third-party CDN dependency.
- **Files touched**:
  - `/app/frontend/public/pdf.worker.min.mjs` (added, ~1 MB)
  - `/app/frontend/src/pages/Reader.jsx` (workerSrc updated)
- **Follow-up**: When `react-pdf` is upgraded, the worker file must be re-copied (`cp node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/`). Consider a `postinstall` script for automation.
- **Status**: ✅ Fixed.

---

## BUG-003: Copy invite link crashes the app — "Clipboard API has been blocked"
- **Reported**: 2026-05-16 (user screenshot of the Invite step in Create-Circle flow)
- **Symptom**: Tapping **Copy** on the invite share screen throws `NotAllowedError: Failed to execute 'writeText' on 'Clipboard': The Clipboard API has been blocked because of a permissions policy applied to the current document.` Inside Emergent's `App Preview` iframe (and in any host that ships a `Permissions-Policy: clipboard-write=()` header), `navigator.clipboard.writeText()` rejects synchronously and the rejection wasn't caught → React shows the red runtime-error overlay.
- **Root cause**: `copyInvite()` called `navigator.clipboard.writeText(inviteUrl)` without a try/catch and without a fallback path. Clipboard API requires both a secure context AND a permissive Permissions-Policy.
- **Fix**:
  1. Wrap `navigator.clipboard.writeText()` in try/catch and only attempt it if `window.isSecureContext` is true.
  2. On failure, fall back to the classic `document.execCommand("copy")` via a hidden `<textarea>` — works in restricted iframes and old browsers.
  3. On final failure, show a Sonner toast telling the user to long-press the link to copy manually.
  4. Make the rendered invite URL `select-all` + auto-select on tap, so manual copy is always possible as the last resort.
  5. Same try/catch applied to the **Share** path (`navigator.share` cancellations no longer fall through silently).
- **Files touched**: `/app/frontend/src/pages/CreateCircle.jsx` (`copyInvite`, `share`, invite-link `<div>`).
- **Status**: ✅ Fixed.

---

## BUG-001: `/api/books/solo` route shadowed by `/api/books/{book_id}`
- **Reported**: 2026-05-16 (testing agent iteration 1)
- **Symptom**: `GET /api/books/solo` returned `404 Book not found` because FastAPI matched the dynamic `{book_id}` route first.
- **Fix**: Re-ordered `/api/books/solo` to be declared before `/api/books/{book_id}` in `server.py`.
- **Status**: ✅ Fixed and verified by curl smoke test.

---

## Bugs That Must Not Come Back (regression guard)
This list captures the failure modes already fixed. Any future change must NOT re-introduce them. The testing agent should keep an eye on these:

| # | Failure mode | Where it lives | What to verify |
|---|---|---|---|
| R-1 | Dynamic CDN URL for PDF.js worker (BUG-002) | `/app/frontend/src/pages/Reader.jsx` | `pdfjs.GlobalWorkerOptions.workerSrc` must be the **local** `/pdf.worker.min.mjs`, not cdnjs/unpkg/jsdelivr. The file must exist at `/app/frontend/public/pdf.worker.min.mjs`. |
| R-2 | Route ordering: `/api/books/solo` shadowed by `/api/books/{book_id}` (BUG-001) | `/app/backend/server.py` | `GET /api/books/solo` (no auth: 401, with auth: `[]` or list) — never `404 Book not found`. The `/solo` route must be declared **before** the `/{book_id}` route. |
| R-3 | Unhandled `navigator.clipboard.writeText` (BUG-003) | `/app/frontend/src/pages/CreateCircle.jsx`, and **anywhere new** that adds a Copy button | Every clipboard write MUST be inside try/catch with a `document.execCommand("copy")` fallback. Test the Copy button inside an iframe / on http://localhost (non-secure context) and confirm no red error overlay. |
| R-4 | MongoDB `_id` leaking into API responses | All endpoints in `/app/backend/server.py` | Every `.find()` / `.find_one()` uses `{"_id": 0}` projection. New endpoints must do the same. |
| R-5 | Unlocking rule bypassed | `/api/books/{id}/highlights`, `/api/turns`, `/api/saved-insights` | Server must filter by `page <= max_page_reached` for the viewing user. Never trust the client. |
| R-6 | OAuth redirect URL hardcoded | `/app/frontend/src/lib/auth.jsx` (`startGoogleLogin`) | Must derive redirect from `window.location.origin`. No fallbacks, no `||`, no env-variable URLs. |
| R-7 | PDF selection re-introduces visible text-layer color (BUG-004) | `/app/frontend/src/index.css` | `::selection` must NOT set `color`. The `.react-pdf__Page__textContent` rules must keep text-layer text transparent at all times, including during selection. |
| R-8 | Duplicate highlight when adding a reflection from the post-action sheet (BUG-005) | `/app/frontend/src/pages/Reader.jsx`, `/app/backend/server.py` | `POST /api/highlights/{id}/thoughts` must exist and the Reader must call it (NOT `POST /api/highlights` again) from `saveReflectionOnExisting`. After Highlight → Add Reflection, `GET /api/books/{id}/highlights` must return exactly 1 highlight row per user-created passage. |
| R-9 | PDF selection toolbar misses some browsers / touch / keyboard (BUG-006) | `/app/frontend/src/pages/Reader.jsx` | The Reader MUST attach a `document.addEventListener("selectionchange")` listener (debounced) AND keep the legacy `onMouseUp`/`onTouchEnd` fallbacks. Do NOT remove either path. |
| R-10 | `URL.parse` polyfill removed → Reader crashes on iOS Safari < 17.4 (BUG-010) | `/app/frontend/src/index.js` | `index.js` MUST keep the `URL.parse` / `URL.canParse` polyfill block at the TOP of the file, before any React or react-pdf import. Removing it re-introduces an `Uncaught runtime errors` overlay on every iOS Safari < 17.4 device. |

`::selection` must NOT set `color`. The `.react-pdf__Page__textContent` rules must keep text-layer text transparent at all times, including during selection. |
| R-8 | Duplicate highlight when adding a reflection from the post-action sheet (BUG-005) | `/app/frontend/src/pages/Reader.jsx`, `/app/backend/server.py` | `POST /api/highlights/{id}/thoughts` must exist and the Reader must call it (NOT `POST /api/highlights` again) from `saveReflectionOnExisting`. After Highlight → Add Reflection, `GET /api/books/{id}/highlights` must return exactly 1 highlight row per user-created passage. |
| R-9 | PDF selection toolbar misses some browsers / touch / keyboard (BUG-006) | `/app/frontend/src/pages/Reader.jsx` | The Reader MUST attach a `document.addEventListener("selectionchange")` listener (debounced) AND keep the legacy `onMouseUp`/`onTouchEnd` fallbacks. Do NOT remove either path. |

