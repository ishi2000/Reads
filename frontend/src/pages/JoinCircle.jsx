import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MobileShell from "../components/MobileShell";
import { api, saveToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";

export default function JoinCircle() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [code, setCode] = useState(codeParam || "");
  const [invite, setInvite] = useState(null);
  const [name, setName] = useState(user?.name || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (codeParam) {
      api.get(`/invites/${codeParam}`).then((r) => setInvite(r.data)).catch(() => {});
    }
  }, [codeParam]);

  const lookup = async () => {
    if (!code.trim()) return;
    try {
      const { data } = await api.get(`/invites/${code.trim()}`);
      setInvite(data);
      navigate(`/join/${code.trim()}`, { replace: true });
    } catch {
      toast.error("Invite not found");
    }
  };

  const join = async () => {
    if (!user && !name.trim()) return toast.error("Add a display name");
    setLoading(true);
    try {
      if (!user) {
        const { data } = await api.post("/auth/anonymous", { display_name: name });
        if (data?.session_token) saveToken(data.session_token);
        await refresh();
      }
      const targetCode = code || codeParam;
      const { data: joined } = await api.post(`/invites/${targetCode}/join`);
      // Open the first book
      const book = invite?.books?.[0];
      if (book) navigate(`/read/${book.book_id}`);
      else navigate("/app/reads");
    } catch {
      toast.error("Could not join");
    } finally {
      setLoading(false);
    }
  };

  if (!codeParam && !invite) {
    return (
      <MobileShell>
        <div className="px-6 pt-12 pb-24">
          <h1 className="font-serif text-[36px] leading-tight">Have an invite?</h1>
          <p className="text-[#787571] mt-2">Paste your invite code below.</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Invite code"
            className="mt-8 w-full border-b border-[#EAE6E1] bg-transparent py-3 font-mono text-lg focus:outline-none focus:border-[#C86A58]"
            data-testid="invite-code-input"
          />
          <button
            onClick={lookup}
            data-testid="lookup-invite"
            className="mt-8 w-full bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full py-4 font-medium"
          >
            Find circle
          </button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="px-6 pt-12 pb-24">
        <div className="text-[10px] tracking-[0.25em] uppercase text-[#A8A5A1]">You&rsquo;re invited to</div>
        <h1
          className="font-serif text-[40px] leading-[1.05] tracking-tight mt-3"
          data-testid="circle-title"
        >
          {invite?.circle?.name || "A reading circle"}
        </h1>
        {invite?.circle?.description && (
          <p className="text-[#787571] mt-3 italic font-serif text-lg">
            &ldquo;{invite.circle.description}&rdquo;
          </p>
        )}
        {invite?.books?.[0] && (
          <div className="mt-8 bg-white border border-[#EAE6E1] rounded-2xl p-5">
            <div className="text-[10px] tracking-[0.2em] uppercase text-[#A8A5A1]">Reading</div>
            <div className="font-serif text-2xl mt-1">{invite.books[0].title}</div>
          </div>
        )}

        {!user && (
          <div className="mt-8">
            <label className="text-[10px] tracking-[0.2em] uppercase text-[#A8A5A1]">
              How shall we call you?
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="A name your circle will see"
              className="mt-2 w-full border-b border-[#EAE6E1] bg-transparent py-3 font-serif text-2xl focus:outline-none focus:border-[#C86A58]"
              data-testid="display-name-input"
            />
            <p className="text-xs text-[#A8A5A1] mt-2">
              No signup needed. You can save and sync later.
            </p>
          </div>
        )}

        <button
          onClick={join}
          disabled={loading}
          data-testid="join-button"
          className="mt-10 w-full bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full py-4 font-medium disabled:opacity-60"
        >
          {loading ? "Opening the room..." : "Start reading"}
        </button>
      </div>
    </MobileShell>
  );
}
