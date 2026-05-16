# Cosift — Bugs Log

Track of known/reported bugs with status. Newest first.

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

## BUG-001: `/api/books/solo` route shadowed by `/api/books/{book_id}`
- **Reported**: 2026-05-16 (testing agent iteration 1)
- **Symptom**: `GET /api/books/solo` returned `404 Book not found` because FastAPI matched the dynamic `{book_id}` route first.
- **Fix**: Re-ordered `/api/books/solo` to be declared before `/api/books/{book_id}` in `server.py`.
- **Status**: ✅ Fixed and verified by curl smoke test.
