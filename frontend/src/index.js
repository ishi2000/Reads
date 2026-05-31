// BUG-010 polyfill — MUST run before any react-pdf / pdfjs-dist import.
// pdfjs-dist 5.x calls `URL.parse(val, base)` internally; this static method
// only exists on Safari 17.4+ / Chrome 120+ / Firefox 115+. Older iOS Safari
// throws "URL.parse is not a function" and the Reader screen crashes.
// Polyfill matches the WHATWG spec: returns a URL on success, null on failure.
//
// NOTE: must use defineProperty (the static URL.parse slot is non-writable on
// some engines), and the whole block must be wrapped in try/catch — assignment
// can throw on engines that already define the symbol with a strict descriptor.
(function polyfillUrlStatics() {
  const safeParse = function parse(input, base) {
    try { return new URL(input, base); } catch { return null; }
  };
  const safeCanParse = function canParse(input, base) {
    try { new URL(input, base); return true; } catch { return false; }
  };
  if (typeof URL.parse !== "function") {
    try {
      Object.defineProperty(URL, "parse", {
        value: safeParse, writable: true, configurable: true,
      });
    } catch { /* engine doesn't allow — caller will branch on `typeof` */ }
  }
  if (typeof URL.canParse !== "function") {
    try {
      Object.defineProperty(URL, "canParse", {
        value: safeCanParse, writable: true, configurable: true,
      });
    } catch { /* same */ }
  }
})();

import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
