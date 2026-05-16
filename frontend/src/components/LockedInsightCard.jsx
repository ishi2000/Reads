import React from "react";
import { Lock } from "lucide-react";

export default function LockedInsightCard({ count, label = "insight" }) {
  return (
    <div
      className="bg-[#F4F2EE] border border-[#EAE6E1]/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 w-full my-4"
      data-testid="locked-insight-card"
    >
      <Lock strokeWidth={1.5} className="text-[#A8A5A1] w-5 h-5" />
      <p className="font-serif italic text-[#787571] text-lg leading-snug">
        {count > 1
          ? `${count} ${label}s waiting on later pages.`
          : `${count} ${label} waiting on a later page.`}
      </p>
      <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-[#A8A5A1] mt-1">
        Read further to unlock
      </p>
    </div>
  );
}
