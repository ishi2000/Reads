import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, saveToken } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/", { replace: true });
      return;
    }
    const sessionId = match[1];

    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id: sessionId });
        if (data?.session_token) saveToken(data.session_token);
        await refresh();
        // Determine return path: prefer pre-hash path if present
        const path = window.location.pathname && window.location.pathname !== "/auth/callback"
          ? window.location.pathname
          : "/app/reads";
        window.history.replaceState(null, "", path);
        navigate(path, { replace: true });
      } catch (e) {
        console.error("Auth callback failed", e);
        navigate("/", { replace: true });
      }
    })();
  }, [navigate, refresh]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center text-[#787571] font-serif italic text-lg">
      Opening your reading nook&hellip;
    </div>
  );
}
