import React from "react";
import BottomSheet from "./BottomSheet";
import { startGoogleLogin, signInApple, requestEmailOtp } from "../lib/auth";
import { toast } from "sonner";

/**
 * UpgradeSheet — Guest → Account conversion modal.
 * Shows Google / Apple / Email-OTP options. Apple + Email OTP are wired but
 * surface a "coming soon" toast (Emergent OAuth currently routes through Google).
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - returnPath: where the OAuth flow should land back to after sign-in
 *  - context: short string used inside the headline (e.g. "your highlights",
 *             "your reflections", "your reading")
 */
export default function UpgradeSheet({ open, onClose, returnPath = "/app/reads", context = "your insights" }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Save your reading" testid="upgrade-sheet">
      <p className="text-[#787571] text-base font-sans leading-relaxed">
        Create an account to save {context}, highlights, reflections, saved words, and reading
        progress across devices.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={() => startGoogleLogin(returnPath)}
          data-testid="upgrade-google"
          className="w-full bg-[#2C2A29] hover:bg-[#1f1d1c] text-white rounded-full py-4 font-medium flex items-center justify-center gap-3"
        >
          <GoogleIcon /> Continue with Google
        </button>
        <button
          onClick={() => toast.message(signInApple().message)}
          data-testid="upgrade-apple"
          className="w-full bg-white border border-[#EAE6E1] text-[#2C2A29] rounded-full py-4 font-medium flex items-center justify-center gap-3 hover:bg-stone-50"
        >
          <AppleIcon /> Continue with Apple
        </button>
        <button
          onClick={() => toast.message(requestEmailOtp().message)}
          data-testid="upgrade-email"
          className="w-full bg-white border border-[#EAE6E1] text-[#2C2A29] rounded-full py-4 font-medium flex items-center justify-center gap-3 hover:bg-stone-50"
        >
          <MailIcon /> Continue with Email
        </button>
      </div>

      <p className="mt-6 text-xs text-[#A8A5A1] text-center">
        Your current session and notes will merge into your new account when sign-in completes.
      </p>
    </BottomSheet>
  );
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.08-1.79 2.72v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.62z" fill="#fff"/>
    <path d="M9 18c2.43 0 4.46-.81 5.95-2.18l-2.9-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.34A9 9 0 0 0 9 18z" fill="#fff"/>
    <path d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.99-2.34z" fill="#fff"/>
    <path d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" fill="#fff"/>
  </svg>
);
const AppleIcon = () => (
  <svg width="16" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 12.04c-.03-3.16 2.58-4.68 2.7-4.75-1.47-2.15-3.76-2.45-4.57-2.48-1.94-.2-3.79 1.15-4.78 1.15-.99 0-2.5-1.12-4.12-1.09-2.12.03-4.08 1.24-5.17 3.13-2.21 3.83-.56 9.48 1.59 12.59 1.05 1.51 2.29 3.21 3.92 3.15 1.58-.06 2.18-1.02 4.09-1.02 1.91 0 2.45 1.02 4.12.99 1.7-.03 2.78-1.54 3.82-3.06 1.2-1.76 1.69-3.46 1.72-3.55-.04-.02-3.3-1.27-3.33-5.06zM14.18 3.69c.87-1.05 1.45-2.52 1.29-3.98-1.25.05-2.76.83-3.66 1.88-.81.93-1.51 2.41-1.32 3.85 1.39.11 2.81-.71 3.69-1.75z"/>
  </svg>
);
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
