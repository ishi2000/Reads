import React, { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Share2, Copy, Check, Download } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { pickCover } from "./BookCard";

const HOST_HASHTAG = "#cosift";

/**
 * ShareCard — Renders a beautiful 1080x1350 share card (Instagram-friendly
 * 4:5 ratio that also crops well in iMessage / WhatsApp link previews).
 * Triggers a 1) navigator.share({files}), 2) clipboard image, 3) download fallback.
 *
 * Props:
 *  - open: boolean (parent decides when to show this overlay)
 *  - onClose
 *  - circleName
 *  - bookTitle
 *  - memberCount
 *  - inviteUrl
 *  - bookId (used for deterministic cover color)
 */
export default function ShareCard({ open, onClose, circleName, bookTitle, memberCount, inviteUrl, bookId }) {
  const cardRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const cover = pickCover(bookId || circleName || bookTitle || "");

  const renderPng = async () => {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#F9F8F6",
    });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return { blob, dataUrl };
  };

  const share = async () => {
    setBusy(true);
    try {
      const out = await renderPng();
      if (!out) return;
      const file = new File([out.blob], `cosift-${(circleName || "circle").replace(/\s+/g, "-").toLowerCase()}.png`, {
        type: "image/png",
      });

      // 1) Web Share API with files (WhatsApp/iMessage/Telegram/Instagram on
      //    iOS/Android Chrome support this).
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Read with me on Cosift`,
            text: `Read “${bookTitle}” with me on Cosift ${inviteUrl} ${HOST_HASHTAG}`,
          });
          return;
        } catch {
          // user dismissed — fall through to copy-link
        }
      }

      // 2) Try writing the image to clipboard (modern browsers)
      try {
        if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
          await navigator.clipboard.write([
            new window.ClipboardItem({ "image/png": out.blob }),
          ]);
          toast.success("Share card copied — paste into any app");
          return;
        }
      } catch {
        /* fall through */
      }

      // 3) Last resort — trigger download + copy link
      const a = document.createElement("a");
      a.href = out.dataUrl;
      a.download = `cosift-${(circleName || "circle").replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      try {
        await navigator.clipboard?.writeText(inviteUrl);
      } catch {}
      toast.success("Share card downloaded — link copied too");
    } catch (e) {
      console.error("ShareCard failed", e);
      toast.error("Could not prepare the share card");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(inviteUrl);
        ok = true;
      }
    } catch {}
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
      } catch {}
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast.message("Long-press the link to copy it.");
    }
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[70] bg-[#2C2A29]/60 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      <div
        className="mt-auto bg-[#F9F8F6] rounded-t-3xl p-6 pb-10 max-w-md mx-auto w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-10 h-1 bg-[#EAE6E1] rounded-full mb-4" />
        <div className="text-center text-[10px] tracking-[0.25em] uppercase text-[#A8A5A1] mb-2">
          Preview
        </div>

        {/* The visible preview also serves as the capture source */}
        <div
          ref={cardRef}
          data-testid="share-card-preview"
          className="relative rounded-2xl overflow-hidden bg-[#F4F2EE]"
          style={{ aspectRatio: "4 / 5" }}
        >
          {/* Soft warm gradient backdrop */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 20% 0%, #EFE6DF 0%, #F4F2EE 55%, #ECE3D8 100%)",
            }}
          />
          {/* Book cover floating */}
          <div className="absolute inset-0 flex flex-col items-center justify-between p-6">
            <div className="w-full flex items-center justify-between">
              <div className="font-serif text-base tracking-wide text-[#2C2A29]">Cosift</div>
              <div className="text-[10px] tracking-[0.25em] uppercase text-[#787571]">
                Reading Circle
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div
                className="w-32 h-44 rounded-md overflow-hidden shadow-[0_24px_40px_-12px_rgba(44,42,41,0.35)] book-spine"
                style={{ transform: "rotate(-3deg)" }}
              >
                <img
                  src={cover}
                  crossOrigin="anonymous"
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-6 text-center px-4">
                <div className="text-[10px] tracking-[0.25em] uppercase text-[#A8A5A1] mb-2">
                  Now reading
                </div>
                <div className="font-serif text-[28px] leading-[1.05] text-[#2C2A29]">
                  {bookTitle || "Untitled"}
                </div>
                <div className="font-serif italic text-base text-[#787571] mt-2">
                  with {circleName || "your circle"}
                </div>
              </div>
            </div>

            <div className="w-full text-center">
              <div className="font-serif italic text-[#2C2A29] text-lg">
                &ldquo;Read with me on Cosift&rdquo;
              </div>
              <div className="text-[10px] tracking-[0.25em] uppercase text-[#A8A5A1] mt-2">
                {memberCount > 1
                  ? `${memberCount} readers · join us`
                  : "Join this quiet reading"}
              </div>
            </div>
          </div>
          {/* Inner border vignette */}
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-[#EAE6E1]/70 pointer-events-none" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            onClick={share}
            disabled={busy}
            data-testid="share-card-send"
            className="col-span-2 bg-[#C86A58] hover:bg-[#B35A4A] disabled:opacity-60 text-white rounded-full py-3 font-medium flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            {busy ? "Preparing…" : "Send share card"}
          </button>
          <button
            onClick={copyLink}
            data-testid="share-card-copy-link"
            className="bg-white border border-[#EAE6E1] text-[#2C2A29] rounded-full py-3 font-medium flex items-center justify-center gap-1 hover:bg-stone-50"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span className="text-sm">{copied ? "Copied" : "Link"}</span>
          </button>
        </div>

        <button
          onClick={async () => {
            const out = await renderPng();
            if (out) {
              const a = document.createElement("a");
              a.href = out.dataUrl;
              a.download = `cosift-${(circleName || "circle").toLowerCase().replace(/\s+/g, "-")}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
          }}
          data-testid="share-card-download"
          className="mt-3 w-full text-[#787571] hover:text-[#2C2A29] text-sm flex items-center justify-center gap-2"
        >
          <Download className="w-3.5 h-3.5" /> Save image
        </button>
      </div>
    </motion.div>
  );
}
