import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, Highlighter, MessageSquare, BookmarkPlus, ArrowLeft, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import BottomSheet from "../components/BottomSheet";
import LockedInsightCard from "../components/LockedInsightCard";
import ActivityBanner from "../components/ActivityBanner";
import { toast } from "sonner";

// PDF.js worker — served locally from public/ to guarantee the worker version matches
// the pdfjs-dist bundled by react-pdf (avoids cdnjs version-not-found errors).
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Reader() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();

  const [book, setBook] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(parseInt(params.get("page") || "1", 10));
  const [pageWidth, setPageWidth] = useState(360);
  const [selectionText, setSelectionText] = useState("");
  const [actionSheet, setActionSheet] = useState(false);
  const [thoughtSheet, setThoughtSheet] = useState(false);
  const [vocabSheet, setVocabSheet] = useState(false);
  const [thoughtText, setThoughtText] = useState("");
  const [vocabMeaning, setVocabMeaning] = useState("");
  const [highlights, setHighlights] = useState([]);
  const [maxPageReached, setMaxPageReached] = useState(0);
  const [lockedCount, setLockedCount] = useState(0);
  const [activeHighlight, setActiveHighlight] = useState(null);
  const [threadReplies, setThreadReplies] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [banner, setBanner] = useState(null);
  const containerRef = useRef(null);

  // Load book + size
  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    api.get(`/books/${bookId}`).then((r) => {
      setBook(r.data);
      const startPage = parseInt(params.get("page") || (r.data.my_progress?.current_page || 1), 10);
      setPage(startPage > 0 ? startPage : 1);
    }).catch(() => toast.error("Could not open book"));
    const w = containerRef.current?.clientWidth || window.innerWidth;
    setPageWidth(Math.min(w - 32, 480));
  }, [bookId, user]);

  // Load highlights when page or maxPageReached changes
  const refreshHighlights = async () => {
    try {
      const { data } = await api.get(`/books/${bookId}/highlights`);
      setHighlights(data.highlights || []);
      setMaxPageReached(data.max_page_reached || 0);
      const { data: lc } = await api.get(`/books/${bookId}/locked-count`);
      setLockedCount(lc.locked || 0);
    } catch {}
  };

  useEffect(() => {
    if (book) refreshHighlights();
  }, [book, page]);

  // Update progress whenever page changes
  useEffect(() => {
    if (!book || !numPages) return;
    api.put("/progress", {
      book_id: bookId,
      current_page: page,
      total_pages: numPages,
    }).then(() => refreshHighlights());
  }, [page, numPages]);

  // Selection handler
  const handleMouseUp = () => {
    const sel = window.getSelection?.();
    const text = sel ? sel.toString().trim() : "";
    if (text && text.length > 2) {
      setSelectionText(text);
      setActionSheet(true);
    }
  };

  // Subtle activity banner when new highlights arrive on current page
  const highlightsOnPage = useMemo(
    () => highlights.filter((h) => h.page === page && h.user_id !== user?.user_id),
    [highlights, page, user],
  );
  useEffect(() => {
    if (highlightsOnPage.length > 0) {
      setBanner(
        highlightsOnPage.length === 1
          ? `${highlightsOnPage[0].user_name} highlighted this page`
          : `${highlightsOnPage.length} new insights on this page`,
      );
      const t = setTimeout(() => setBanner(null), 3800);
      return () => clearTimeout(t);
    }
  }, [page, highlightsOnPage.length]);

  // Actions
  const saveHighlight = async (withThought = false) => {
    if (!selectionText) return;
    try {
      await api.post("/highlights", {
        book_id: bookId,
        page,
        text: selectionText,
        thought: withThought ? thoughtText : "",
      });
      toast.success(withThought ? "Thought saved" : "Highlighted");
      setSelectionText("");
      setThoughtText("");
      setActionSheet(false);
      setThoughtSheet(false);
      refreshHighlights();
    } catch {
      toast.error("Could not save");
    }
  };

  const saveVocab = async () => {
    if (!selectionText) return;
    try {
      await api.post("/vocabulary", {
        book_id: bookId,
        word: selectionText,
        meaning: vocabMeaning,
        page,
      });
      toast.success("Saved to vocabulary");
      setSelectionText("");
      setVocabMeaning("");
      setVocabSheet(false);
      setActionSheet(false);
    } catch {
      toast.error("Could not save");
    }
  };

  const openHighlight = async (h) => {
    setActiveHighlight(h);
    try {
      const { data } = await api.get(`/highlights/${h.highlight_id}/threads`);
      setThreadReplies(data || []);
    } catch {
      setThreadReplies([]);
    }
  };

  const postReply = async () => {
    if (!replyText.trim() || !activeHighlight) return;
    try {
      await api.post(`/highlights/${activeHighlight.highlight_id}/threads`, {
        text: replyText,
      });
      setReplyText("");
      const { data } = await api.get(`/highlights/${activeHighlight.highlight_id}/threads`);
      setThreadReplies(data || []);
      refreshHighlights();
    } catch {
      toast.error("Could not reply");
    }
  };

  if (!book) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-[#787571] font-serif italic">
        Opening the book…
      </div>
    );
  }

  const pdfUrl = `${BACKEND_URL}/api/files/${book.file_id}`;
  const isFuturePage = page > maxPageReached;

  return (
    <div className="min-h-[100dvh] bg-[#F9F8F6] relative" data-testid="reader-screen">
      {/* Top bar */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 glass border-b border-[#EAE6E1]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => navigate("/app/reads")}
            className="text-[#2C2A29] p-1"
            data-testid="reader-back"
          >
            <ArrowLeft strokeWidth={1.5} className="w-5 h-5" />
          </button>
          <div className="text-center px-2 min-w-0">
            <div className="text-[10px] tracking-[0.2em] uppercase text-[#A8A5A1] truncate">
              {book.mode === "circle" ? "Reading together" : "Solo"}
            </div>
            <div className="font-serif text-base text-[#2C2A29] truncate">{book.title}</div>
          </div>
          <div className="text-xs tabular-nums text-[#787571] w-12 text-right">
            {numPages ? `${page}/${numPages}` : ""}
          </div>
        </div>
        {/* Progress dots */}
        {numPages > 0 && (
          <div className="h-1 bg-stone-100">
            <div
              className="h-full bg-[#C86A58]"
              style={{ width: `${(page / numPages) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* PDF area */}
      <div
        ref={containerRef}
        className="pt-20 pb-32 px-4 max-w-md mx-auto"
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
      >
        <ActivityBanner message={banner} visible={!!banner} />

        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<p className="text-center text-[#A8A5A1] font-serif italic mt-12">Loading pages…</p>}
          error={<p className="text-center text-[#A8A5A1] font-serif italic mt-12">Could not open this PDF.</p>}
        >
          <Page
            pageNumber={page}
            width={pageWidth}
            renderAnnotationLayer={false}
            renderTextLayer={true}
            className="shadow-sm bg-white rounded-lg overflow-hidden"
          />
        </Document>

        {/* Highlights & locked indicator for current page */}
        <div className="mt-4">
          {isFuturePage ? (
            <LockedInsightCard count={Math.max(1, highlights.length)} />
          ) : (
            <>
              {highlightsOnPage.length === 0 && lockedCount === 0 && (
                <p className="text-center text-[#A8A5A1] text-xs font-sans italic mt-3">
                  Pause and reflect. Select any passage to highlight.
                </p>
              )}
              {highlightsOnPage.map((h) => (
                <button
                  key={h.highlight_id}
                  onClick={() => openHighlight(h)}
                  data-testid={`highlight-${h.highlight_id}`}
                  className="w-full text-left mt-3 bg-white border border-[#EAE6E1] rounded-2xl p-4 hover:border-[#C86A58]/40 transition-colors"
                >
                  <p className="hl-mark inline font-serif italic text-[#2C2A29]">&ldquo;{h.text}&rdquo;</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-[#787571]">
                    <span>{h.user_name}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {h.reply_count} replies
                    </span>
                  </div>
                  {h.thoughts?.[0] && (
                    <p className="mt-2 text-sm text-[#787571] line-clamp-2">
                      &mdash; {h.thoughts[0].text}
                    </p>
                  )}
                </button>
              ))}
              {lockedCount > 0 && page === maxPageReached && (
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#A8A5A1]">
                  <Lock className="w-3 h-3" /> {lockedCount} insights wait ahead
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Page navigation */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md flex justify-center gap-2 z-30 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 bg-white/90 backdrop-blur-md border border-[#EAE6E1] rounded-full shadow-sm px-2 py-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            data-testid="page-prev"
            className="p-2 disabled:opacity-30"
          >
            <ChevronLeft strokeWidth={1.5} className="w-5 h-5" />
          </button>
          <span className="text-xs tabular-nums text-[#787571] px-2">{page}</span>
          <button
            disabled={numPages ? page >= numPages : false}
            onClick={() => setPage((p) => p + 1)}
            data-testid="page-next"
            className="p-2 disabled:opacity-30"
          >
            <ChevronRight strokeWidth={1.5} className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Floating selection toolbar */}
      <AnimatePresence>
        {selectionText && !actionSheet && !thoughtSheet && !vocabSheet && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="fixed bottom-40 left-1/2 -translate-x-1/2 max-w-md w-[calc(100%-2rem)] z-40"
          >
            <div className="flex items-center gap-1 bg-[#2C2A29] text-white rounded-full px-2 py-1 shadow-lg">
              <button
                onClick={() => saveHighlight(false)}
                data-testid="action-highlight"
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 hover:bg-white/10 rounded-full"
              >
                <Highlighter className="w-4 h-4" />
                <span className="text-sm">Highlight</span>
              </button>
              <button
                onClick={() => {
                  setActionSheet(false);
                  setThoughtSheet(true);
                }}
                data-testid="action-thought"
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 hover:bg-white/10 rounded-full"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm">Thought</span>
              </button>
              <button
                onClick={() => setVocabSheet(true)}
                data-testid="action-vocab"
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 hover:bg-white/10 rounded-full"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span className="text-sm">Vocab</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thought sheet */}
      <BottomSheet
        open={thoughtSheet}
        onClose={() => setThoughtSheet(false)}
        title="Add a thought"
        testid="thought-sheet"
      >
        <p className="font-serif italic text-[#787571] text-lg">&ldquo;{selectionText}&rdquo;</p>
        <textarea
          value={thoughtText}
          onChange={(e) => setThoughtText(e.target.value)}
          placeholder="A reflection, a question, a feeling…"
          rows={5}
          className="mt-4 w-full border border-[#EAE6E1] rounded-xl bg-white p-3 focus:outline-none focus:border-[#C86A58] resize-none"
          data-testid="thought-input"
        />
        <button
          onClick={() => saveHighlight(true)}
          data-testid="thought-save"
          className="mt-4 w-full bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full py-3 font-medium"
        >
          Save thought
        </button>
      </BottomSheet>

      {/* Vocab sheet */}
      <BottomSheet
        open={vocabSheet}
        onClose={() => setVocabSheet(false)}
        title="Add to vocabulary"
        testid="vocab-sheet"
      >
        <p className="font-serif text-2xl text-[#2C2A29]">{selectionText}</p>
        <textarea
          value={vocabMeaning}
          onChange={(e) => setVocabMeaning(e.target.value)}
          placeholder="Meaning, etymology, or a note (optional)"
          rows={4}
          className="mt-4 w-full border border-[#EAE6E1] rounded-xl bg-white p-3 focus:outline-none focus:border-[#C86A58] resize-none"
          data-testid="vocab-input"
        />
        <button
          onClick={saveVocab}
          data-testid="vocab-save"
          className="mt-4 w-full bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full py-3 font-medium"
        >
          Save word
        </button>
      </BottomSheet>

      {/* Thread sheet */}
      <BottomSheet
        open={!!activeHighlight}
        onClose={() => setActiveHighlight(null)}
        title="In the margins"
        testid="thread-sheet"
      >
        {activeHighlight && (
          <>
            <p className="font-serif italic text-[#2C2A29] text-lg leading-snug">
              &ldquo;{activeHighlight.text}&rdquo;
            </p>
            <div className="text-[10px] tracking-[0.2em] uppercase text-[#A8A5A1] mt-1">
              {activeHighlight.user_name} · p. {activeHighlight.page}
            </div>
            {activeHighlight.thoughts?.map((t) => (
              <div key={t.thought_id} className="mt-4 bg-[#F4F2EE] rounded-xl p-3">
                <p className="text-sm text-[#2C2A29]">{t.text}</p>
                <div className="text-[10px] text-[#A8A5A1] mt-1">{t.user_name}</div>
              </div>
            ))}
            <div className="mt-6 flex flex-col gap-3">
              {threadReplies.map((r) => (
                <div key={r.thread_id} className="border-l-2 border-[#C86A58]/40 pl-3" data-testid={`reply-${r.thread_id}`}>
                  <p className="text-sm text-[#2C2A29]">{r.text}</p>
                  <div className="text-[10px] text-[#A8A5A1] mt-1">{r.user_name}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2 items-end">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Add a quiet reply…"
                rows={2}
                className="flex-1 border border-[#EAE6E1] rounded-xl bg-white p-3 text-sm focus:outline-none focus:border-[#C86A58] resize-none"
                data-testid="reply-input"
              />
              <button
                onClick={postReply}
                data-testid="reply-send"
                className="bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full px-4 py-2 text-sm font-medium"
              >
                Send
              </button>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
