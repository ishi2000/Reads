import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import MobileShell from "../components/MobileShell";
import ShareCard from "../components/ShareCard";
import { ArrowLeft, Upload, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function CreateCircle() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [circleId, setCircleId] = useState(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookId, setBookId] = useState(null);
  const [memberCount, setMemberCount] = useState(1);
  const [file, setFile] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);

  if (!user) {
    navigate("/", { replace: true });
    return null;
  }

  const submitCircle = async () => {
    if (!name.trim()) return toast.error("Give your circle a name");
    setLoading(true);
    try {
      const { data } = await api.post("/circles", { name, description });
      setCircleId(data.circle_id);
      setStep(2);
    } catch (e) {
      toast.error("Could not create circle");
    } finally {
      setLoading(false);
    }
  };

  const submitBook = async () => {
    if (!bookTitle.trim() || !file) return toast.error("Add a title and a PDF");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("title", bookTitle);
      fd.append("circle_id", circleId);
      fd.append("mode", "circle");
      fd.append("file", file);
      const { data: bk } = await api.post("/books", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setBookId(bk.book_id);
      const { data } = await api.post(`/circles/${circleId}/invite`);
      setInviteCode(data.code);
      try {
        const { data: circle } = await api.get(`/circles/${circleId}`);
        setMemberCount(circle?.members?.length || 1);
      } catch {}
      setStep(3);
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const inviteUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : "";

  const copyInvite = async () => {
    let ok = false;
    // Primary path — modern clipboard API. Wrapped in try/catch because preview
    // iframes / Permissions-Policy can throw NotAllowedError (BUG-003).
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(inviteUrl);
        ok = true;
      }
    } catch {
      ok = false;
    }
    // Fallback — hidden textarea + document.execCommand("copy"). Works in
    // restricted contexts (preview iframe, older browsers).
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = inviteUrl;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast.message("Long-press the link above to copy it.");
    }
  };

  const share = async () => {
    // Opens the rich ShareCard composer; that component handles Web Share API,
    // clipboard image fallback, and download fallback for restricted contexts.
    setShareCardOpen(true);
  };

  return (
    <MobileShell>
      <div className="px-6 pt-6 pb-24">
        <button
          onClick={() => navigate(-1)}
          className="text-[#787571] hover:text-[#2C2A29] flex items-center gap-1 text-sm"
          data-testid="back-button"
        >
          <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> Back
        </button>

        <div className="mt-6 text-[10px] tracking-[0.25em] uppercase text-[#A8A5A1] font-sans">
          Step {step} of 3
        </div>

        {step === 1 && (
          <>
            <h1 className="font-serif text-[36px] leading-tight tracking-tight mt-2">
              Name your circle
            </h1>
            <p className="text-[#787571] mt-2">A quiet room for a few readers, or many.</p>
            <div className="mt-8 flex flex-col gap-4">
              <label className="text-[10px] tracking-[0.2em] uppercase text-[#A8A5A1]">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The Slow Readers"
                className="border-b border-[#EAE6E1] bg-transparent py-3 font-serif text-2xl text-[#2C2A29] focus:outline-none focus:border-[#C86A58]"
                data-testid="circle-name-input"
              />
              <label className="text-[10px] tracking-[0.2em] uppercase text-[#A8A5A1] mt-4">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Why are you reading together?"
                rows={3}
                className="border border-[#EAE6E1] rounded-xl bg-white p-3 text-[#2C2A29] focus:outline-none focus:border-[#C86A58] resize-none"
                data-testid="circle-description-input"
              />
              <button
                onClick={submitCircle}
                disabled={loading}
                data-testid="submit-circle"
                className="mt-6 w-full bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full py-4 font-medium disabled:opacity-60"
              >
                {loading ? "Creating..." : "Continue"}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-serif text-[36px] leading-tight tracking-tight mt-2">
              Add the first book
            </h1>
            <p className="text-[#787571] mt-2">Upload a PDF. Your circle reads it together.</p>
            <div className="mt-8 flex flex-col gap-4">
              <label className="text-[10px] tracking-[0.2em] uppercase text-[#A8A5A1]">Title</label>
              <input
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="The Art of Slow Reading"
                className="border-b border-[#EAE6E1] bg-transparent py-3 font-serif text-2xl text-[#2C2A29] focus:outline-none focus:border-[#C86A58]"
                data-testid="book-title-input"
              />
              <label
                htmlFor="pdf-upload"
                className="mt-4 border-2 border-dashed border-[#EAE6E1] rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-white hover:border-[#C86A58] transition-colors"
                data-testid="pdf-upload-area"
              >
                <Upload strokeWidth={1.5} className="w-6 h-6 text-[#A8A5A1]" />
                <span className="text-sm font-sans text-[#2C2A29]">
                  {file ? file.name : "Tap to choose a PDF"}
                </span>
                <input
                  id="pdf-upload"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  data-testid="pdf-upload-input"
                />
              </label>
              <button
                onClick={submitBook}
                disabled={loading}
                data-testid="submit-book"
                className="mt-6 w-full bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full py-4 font-medium disabled:opacity-60"
              >
                {loading ? "Uploading..." : "Upload book"}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="font-serif text-[36px] leading-tight tracking-tight mt-2">
              Invite your readers
            </h1>
            <p className="text-[#787571] mt-2">
              Share this private link. They&rsquo;ll start reading instantly &mdash; no signup needed.
            </p>
            <div className="mt-8 bg-white border border-[#EAE6E1] rounded-2xl p-5">
              <div className="text-[10px] tracking-[0.2em] uppercase text-[#A8A5A1]">Invite link</div>
              <div
                className="mt-2 font-mono text-sm text-[#2C2A29] break-all select-all cursor-text"
                onClick={(e) => {
                  // Auto-select the URL when tapped, so users can copy manually
                  // if the Clipboard API is blocked by the host environment.
                  const range = document.createRange();
                  range.selectNodeContents(e.currentTarget);
                  const sel = window.getSelection();
                  sel.removeAllRanges();
                  sel.addRange(range);
                }}
                data-testid="invite-link"
              >
                {inviteUrl}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={copyInvite}
                  data-testid="copy-invite"
                  className="flex-1 flex items-center justify-center gap-2 bg-[#2C2A29] hover:bg-[#1f1d1c] text-white rounded-full py-3 font-medium"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> Copy
                    </>
                  )}
                </button>
                <button
                  onClick={share}
                  data-testid="share-invite"
                  className="flex-1 bg-white border border-[#EAE6E1] text-[#2C2A29] rounded-full py-3 font-medium hover:bg-stone-50"
                >
                  Share
                </button>
              </div>
            </div>
            <button
              onClick={() => navigate("/app/reads")}
              data-testid="open-reads"
              className="mt-8 w-full bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full py-4 font-medium"
            >
              Open my reads
            </button>
          </>
        )}
      </div>
      <ShareCard
        open={shareCardOpen}
        onClose={() => setShareCardOpen(false)}
        circleName={name}
        bookTitle={bookTitle}
        memberCount={memberCount}
        inviteUrl={inviteUrl}
        bookId={bookId}
      />
    </MobileShell>
  );
}
