import React from "react";

export default function MobileShell({ children, className = "" }) {
  return (
    <div className="min-h-[100dvh] w-full flex justify-center bg-[#F9F8F6]">
      <div
        className={`w-full max-w-md min-h-[100dvh] relative bg-[#F9F8F6] overflow-x-hidden ${className}`}
        data-testid="mobile-shell"
      >
        {children}
      </div>
    </div>
  );
}
