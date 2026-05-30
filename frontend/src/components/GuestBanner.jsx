import React from "react";
import { Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";

/**
 * GuestBanner — Subtle, persistent "save your progress" prompt for anonymous
 * users. Sits at the top of guest-facing screens.
 *
 *  - visible: boolean — render or not
 *  - onUpgrade: () => void — opens the UpgradeSheet
 *  - onDismiss: () => void — optional close (per-session)
 *  - context?: short label used in the message
 */
export default function GuestBanner({ visible, onUpgrade, onDismiss, context = "highlights" }) {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-6 mt-4 mb-2 rounded-2xl border border-[#EAE6E1] bg-white/90 backdrop-blur-md p-4 flex items-start gap-3"
      data-testid="guest-banner"
    >
      <Sparkles strokeWidth={1.5} className="w-4 h-4 mt-0.5 text-[#C86A58] flex-shrink-0" />
      <div className="flex-1">
        <p className="font-serif text-base leading-snug text-[#2C2A29]">
          Save your {context} across devices.
        </p>
        <p className="text-xs text-[#787571] mt-1">
          Stored only on this device for now.
        </p>
        <button
          onClick={onUpgrade}
          data-testid="guest-banner-upgrade"
          className="mt-3 inline-flex items-center text-sm text-[#C86A58] hover:text-[#B35A4A] font-medium"
        >
          Create an account
        </button>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          data-testid="guest-banner-dismiss"
          className="text-[#A8A5A1] hover:text-[#787571] p-1"
          aria-label="Dismiss"
        >
          <X strokeWidth={1.5} className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}
