import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, Highlighter, MessageSquare, BookmarkPlus, ArrowLeft, Lock, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import { useAuth, isGuest } from "../lib/auth";
import BottomSheet from "../components/BottomSheet";
import LockedInsightCard from "../components/LockedInsightCard";
import ActivityBanner from "../components/ActivityBanner";
import GuestBanner from "../components/GuestBanner";
import UpgradeSheet from "../components/UpgradeSheet";
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
  const [postCreateHighlight, setPostCreateHighlight] = useState(null); // highlight obj for post-action menu
  const [actionSheet, setActionSheet] = useState(false);
  const [thoughtSheet, setThoughtSheet] = useState(false);
  const [vocabSheet, setVocabSheet] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
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

  // Selection handler — listen to `selectionchange` on the document so we
  // catch selections from mouse drags, touch drags, AND keyboard selections.
  // We debounce so the toolbar only appears after the user stops adjusting
  // their selection. On mouse/touch end we also re-check immediately because
  // some browsers fire selectionchange BEFORE the final selection is committed.
  useEffect(() => {
    if (!book) return;
    let debounce = null;
    const readSelection = () => {
      const sel = window.getSelection?.();
      const text = sel ? sel.toString().trim() : "";
      // Only react to selections that originate inside the PDF text layer.
      const anchorNode = sel?.anchorNode;
      const inPdf =
        anchorNode &&
        (anchorNode.nodeType === 1
          ? anchorNode.closest?.(".react-pdf__Page__textContent")
          : anchorNode.parentElement?.closest?.(".react-pdf__Page__textContent"));
      if (text && text.length > 1 && inPdf) {
        setSelectionText(text);
      } else if (!text) {
        // Selection collapsed — only close the floating toolbar (don't dismiss
        // open bottom-sheets in the middle of editing a reflection/word).
        if (!thoughtSheet && !vocabSheet && !postCreateHighlight && !activeHighlight) {
          setSelectionText("");
        }
      }
    };
    const onChange = () => {
      clearTimeout(debounce);
      debounce = setTimeout(readSelection, 120);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      document.removeEventListener("selectionchange", onChange);
      clearTimeout(debounce);
    };
  }, [book, thoughtSheet, vocabSheet, postCreateHighlight, activeHighlight]);

  // Kept for backward-compatibility with the existing JSX (PDF area still
  // listens to mouseUp/touchEnd as a hint to re-read selection immediately).
  const handleMouseUp = () => {
    setTimeout(() => {
      const sel = window.getSelection?.();
      const text = sel ? sel.toString().trim() : "";
      if (text && text.length > 1) setSelectionText(text);
    }, 60);
  };

  // All highlights on the current page — INCLUDING the user's own
  // (so their saved highlights + reflections are visible on the Reader page).
  const highlightsOnPage = useMemo(
    () => highlights.filter((h) => h.page === page),
    [highlights, page],
  );
  // Activity banner should only fire for OTHERS' new highlights, not ours.
  const othersHighlightsOnPage = useMemo(
    () => highlightsOnPage.filter((h) => h.user_id !== user?.user_id),
    [highlightsOnPage, user],
  );
  useEffect(() => {
    if (othersHighlightsOnPage.length > 0) {
      setBanner(
        othersHighlightsOnPage.length === 1
          ? `${othersHighlightsOnPage[0].user_name} highlighted this page`
          : `${othersHighlightsOnPage.length} new insights on this page`,
      );
      const t = setTimeout(() => setBanner(null), 3800);
      return () => clearTimeout(t);
    }
  }, [page, othersHighlightsOnPage.length]);

  const guest = isGuest(user);

  // After a guest creates an annotation, nudge them once toward sign-up.
  const remindGuest = (kind = "insight") => {
    if (!guest) return;
    toast.message(
      `Your ${kind} is stored temporarily on this device.`,
      {
        description: "Create an account to sync and never lose your insights.",
        action: { label: "Save", onClick: () => setUpgradeOpen(true) },
        duration: 5500,
      },
    );
  };

  // Actions
  const saveHighlight = async (withThought = false) => {
    if (!selectionText) return;
    try {
      const { data } = await api.post("/highlights", {
        book_id: bookId,
        page,
        text: selectionText,
        thought: withThought ? thoughtText : "",
      });
      toast.success(withThought ? "Reflection saved" : "Highlighted");
      setThoughtText("");
      setActionSheet(false);
      setThoughtSheet(false);
      // Only open the post-create sheet for a plain highlight tap. If the
      // user already added a reflection during creation, there's no follow-up.
      if (!withThought) {
        const created = { ...data, thoughts: [] };
        setPostCreateHighlight(created);
      } else {
        setSelectionText("");
      }
      refreshHighlights();
      remindGuest(withThought ? "reflection" : "highlight");
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
      toast.success("Saved to your words");
      setSelectionText("");
      setVocabMeaning("");
      setVocabSheet(false);
      setActionSheet(false);
      remindGuest("saved word");
    } catch {
      toast.error("Could not save");
    }
  };

  // Save a reflection onto an EXISTING highlight (no duplicate row created).
  const saveReflectionOnExisting = async () => {
    if (!postCreateHighlight || !thoughtText.trim()) {
      setThoughtSheet(false);
      return;
    }
    try {
      await api.post(`/highlights/${postCreateHighlight.highlight_id}/thoughts`, {
        text: thoughtText.trim(),
      });
      toast.success("Reflection saved");
      setThoughtText("");
      setThoughtSheet(false);
      setPostCreateHighlight(null);
      setSelectionText("");
      refreshHighlights();
      remindGuest("reflection");
    } catch {
      toast.error("Could not save reflection");
    }
  };

  // Save a word to vocabulary tied to the highlighted passage (no duplicate
  // highlight created — vocabulary lives in its own collection).
  const saveVocabFromPost = async () => {
    if (!postCreateHighlight) return saveVocab();
    try {
      await api.post("/vocabulary", {
        book_id: bookId,
        word: postCreateHighlight.text,
        meaning: vocabMeaning,
        page: postCreateHighlight.page,
      });
      toast.success("Saved to your words");
      setVocabMeaning("");
      setVocabSheet(false);
      setPostCreateHighlight(null);
      setSelectionText("");
      remindGuest("saved word");
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
      remindGuest("reply");
    } catch {
      toast.error("Could not reply");
    }
  };

  const shareSelection = async () => {
    const url = `${window.location.origin}/read/${bookId}?page=${page}`;
    const text = `“${selectionText}”\n— ${book.title}, p. ${page}\n\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: book.title, text });
        return;
      }
    } catch { /* user dismissed */ }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast.success("Passage copied to clipboard");
        return;
      }
    } catch { /* fall through */ }
    toast.message("Long-press the passage to copy it.");
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

        {guest && !bannerDismissed && (
          <div className="-mx-4 mb-2">
            <GuestBanner
              visible
              context="highlights and reading"
              onUpgrade={() => setUpgradeOpen(true)}
              onDismiss={() => setBannerDismissed(true)}
            />
          </div>
        )}

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
              {highlightsOnPage.map((h) => {
                const isYou = h.user_id === user?.user_id;
                return (
                  <button
                    key={h.highlight_id}
                    onClick={() => openHighlight(h)}
                    data-testid={`highlight-${h.highlight_id}`}
                    className={`w-full text-left mt-3 bg-white rounded-2xl p-4 hover:border-[#C86A58]/40 transition-colors ${
                      isYou
                        ? "border border-[#C86A58]/30 border-l-2 border-l-[#C86A58]"
                        : "border border-[#EAE6E1]"
                    }`}
                  >
                    <p className="hl-mark inline font-serif italic text-[#2C2A29]">&ldquo;{h.text}&rdquo;</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-[#787571]">
                      <span className="flex items-center gap-2">
                        {h.user_name}
                        {isYou && (
                          <span
                            data-testid="you-indicator"
                            className="px-1.5 py-0.5 rounded-full bg-[#C86A58]/10 text-[#C86A58] text-[10px] font-sans tracking-wider uppercase"
                          >
                            You
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> {h.reply_count} replies
                      </span>
                    </div>
                    {h.thoughts?.[0] && (
                      <p
                        data-testid={`reflection-${h.highlight_id}`}
                        className="mt-2 text-sm text-[#787571] line-clamp-2"
                      >
                        &mdash; {h.thoughts[0].text}
                      </p>
                    )}
                  </button>
                );
              })}
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
      {/* Page navigation */}
      <div className="fixed bottom-28 left-1/2 -translate-x-1/2 w-full max-w-md flex justify-center gap-2 z-30 pointer-events-none">
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

      {/* Floating selection toolbar — primary actions: Highlight + Share.
          NOTE: Framer Motion writes inline `transform` which overrides
          Tailwind's `-translate-x-1/2`. We center via `x: "-50%"` in motion
          props instead, so the pill stays on-screen on mobile (BUG-007). */}
      <AnimatePresence>
        {selectionText && !actionSheet && !thoughtSheet && !vocabSheet && !postCreateHighlight && (
          <motion.div
            initial={{ opacity: 0, x: "-50%", y: 10 }}
            animate={{ opacity: 1, x: "-50%", y: 0 }}
            exit={{ opacity: 0, x: "-50%", y: 6 }}
            className="fixed bottom-44 left-1/2 max-w-md w-[calc(100%-2rem)] z-40"
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
              <div className="w-px h-5 bg-white/15" />
              <button
                onClick={shareSelection}
                data-testid="action-share"
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 hover:bg-white/10 rounded-full"
              >
                <Share2 className="w-4 h-4" />
                <span className="text-sm">Share</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-create action sheet: Add Reflection / Start Discussion / Save Word */}
      <BottomSheet
        open={!!postCreateHighlight}
        onClose={() => {
          setPostCreateHighlight(null);
          setSelectionText("");
        }}
        title="What next?"
        testid="post-action-sheet"
      >
        {postCreateHighlight && (
          <>
            <p className="font-serif italic text-[#2C2A29] text-lg leading-snug">
              &ldquo;{postCreateHighlight.text}&rdquo;
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => {
                  setSelectionText(postCreateHighlight.text);
                  // KEEP postCreateHighlight set — saveReflectionOnExisting()
                  // needs it to attach to the existing highlight (BUG-005).
                  setThoughtSheet(true);
                }}
                data-testid="post-add-reflection"
                className="w-full flex items-center gap-3 bg-white border border-[#EAE6E1] hover:border-[#C86A58]/40 rounded-2xl p-4 text-left"
              >
                <MessageSquare strokeWidth={1.5} className="w-5 h-5 text-[#C86A58]" />
                <div>
                  <div className="font-serif text-lg text-[#2C2A29]">Add Reflection</div>
                  <div className="text-xs text-[#787571]">Capture a personal margin note.</div>
                </div>
              </button>
              <button
                onClick={async () => {
                  // Open this highlight's discussion thread
                  const hl = postCreateHighlight;
                  setPostCreateHighlight(null);
                  setSelectionText("");
                  setActiveHighlight(hl);
                  try {
                    const { data } = await api.get(`/highlights/${hl.highlight_id}/threads`);
                    setThreadReplies(data || []);
                  } catch {
                    setThreadReplies([]);
                  }
                }}
                data-testid="post-start-discussion"
                className="w-full flex items-center gap-3 bg-white border border-[#EAE6E1] hover:border-[#C86A58]/40 rounded-2xl p-4 text-left"
              >
                <Share2 strokeWidth={1.5} className="w-5 h-5 text-[#C86A58]" />
                <div>
                  <div className="font-serif text-lg text-[#2C2A29]">Start Discussion</div>
                  <div className="text-xs text-[#787571]">Invite quiet replies from your circle.</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setSelectionText(postCreateHighlight.text);
                  // KEEP postCreateHighlight set — saveVocabFromPost() reads it.
                  setVocabSheet(true);
                }}
                data-testid="post-save-word"
                className="w-full flex items-center gap-3 bg-white border border-[#EAE6E1] hover:border-[#C86A58]/40 rounded-2xl p-4 text-left"
              >
                <BookmarkPlus strokeWidth={1.5} className="w-5 h-5 text-[#C86A58]" />
                <div>
                  <div className="font-serif text-lg text-[#2C2A29]">Save Word</div>
                  <div className="text-xs text-[#787571]">Keep it for your vocabulary.</div>
                </div>
              </button>
            </div>
          </>
        )}
      </BottomSheet>

      {/* Reflection sheet */}
      <BottomSheet
        open={thoughtSheet}
        onClose={() => setThoughtSheet(false)}
        title="Add a reflection"
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
          onClick={() => (postCreateHighlight ? saveReflectionOnExisting() : saveHighlight(true))}
          data-testid="thought-save"
          className="mt-4 w-full bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full py-3 font-medium"
        >
          Save reflection
        </button>
      </BottomSheet>

      {/* Saved Word sheet */}
      <BottomSheet
        open={vocabSheet}
        onClose={() => setVocabSheet(false)}
        title="Save a word"
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
          onClick={() => (postCreateHighlight ? saveVocabFromPost() : saveVocab())}
          data-testid="vocab-save"
          className="mt-4 w-full bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full py-3 font-medium"
        >
          Save word
        </button>
      </BottomSheet>

      {/* Discussion sheet (was: Thread) */}
      <BottomSheet
        open={!!activeHighlight}
        onClose={() => setActiveHighlight(null)}
        title="Discussion"
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
            <div className="mt-6 flex flex-col gap-3">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Add a quiet reply…"
                rows={3}
                className="w-full border border-[#EAE6E1] rounded-xl bg-white p-3 text-sm focus:outline-none focus:border-[#C86A58] resize-none"
                data-testid="reply-input"
              />
              <button
                onClick={postReply}
                data-testid="reply-send"
                className="w-full bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full py-3 text-sm font-medium"
              >
                Send
              </button>
            </div>
          </>
        )}
      </BottomSheet>

      <UpgradeSheet
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        returnPath={`/read/${bookId}`}
      />
    </div>
  );
}
