import React, { useEffect, useState } from "react";
import MobileShell from "../components/MobileShell";
import BottomTabBar from "../components/BottomTabBar";
import { api } from "../lib/api";
import { useAuth, isGuest } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import GuestBanner from "../components/GuestBanner";
import UpgradeSheet from "../components/UpgradeSheet";

export default function Personal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("thoughts");
  const [thoughts, setThoughts] = useState([]);
  const [vocab, setVocab] = useState([]);
  const [insights, setInsights] = useState([]);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const guest = isGuest(user);

  useEffect(() => {
    api.get("/my-thoughts").then((r) => setThoughts(r.data || []));
    api.get("/vocabulary").then((r) => setVocab(r.data || []));
    api.get("/saved-insights").then((r) => setInsights(r.data || []));
  }, []);

  const tabs = [
    { id: "thoughts", label: "Reflections" },
    { id: "vocabulary", label: "Saved Words" },
    { id: "insights", label: "Insights" },
  ];

  return (
    <MobileShell>
      <div className="px-6 pt-10 pb-32">
        <div className="text-[10px] tracking-[0.3em] uppercase text-[#A8A5A1]">
          {user?.anonymous ? "Guest reader" : user?.email}
        </div>
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-tight mt-1">
          {user?.name || "Reader"}
        </h1>

        {guest && (
          <div className="-mx-6">
            <GuestBanner
              visible
              context="reflections, words and progress"
              onUpgrade={() => setUpgradeOpen(true)}
            />
          </div>
        )}

        <div className="mt-6 flex gap-1 bg-white border border-[#EAE6E1] rounded-full p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`personal-tab-${t.id}`}
              className={`flex-1 py-2 px-3 rounded-full text-xs font-sans tracking-wider uppercase transition-colors ${
                tab === t.id ? "bg-[#2C2A29] text-white" : "text-[#787571]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "thoughts" && (
          <div className="mt-6 flex flex-col gap-3">
            {thoughts.length === 0 && (
              <p className="text-center text-[#A8A5A1] font-serif italic mt-12">
                Your reflections will appear here.
              </p>
            )}
            {thoughts.map((h) => (
              <div
                key={h.highlight_id}
                className="bg-white border border-[#EAE6E1] rounded-2xl p-4"
                data-testid={`thought-${h.highlight_id}`}
              >
                <div className="text-[10px] tracking-[0.2em] uppercase text-[#A8A5A1]">
                  Page {h.page}
                </div>
                <p className="font-serif italic text-lg text-[#2C2A29] mt-1 leading-snug">
                  &ldquo;{h.text}&rdquo;
                </p>
                {h.my_thoughts?.map((t) => (
                  <p key={t.thought_id} className="mt-2 text-sm text-[#787571]">
                    — {t.text}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}

        {tab === "vocabulary" && (
          <div className="mt-6 flex flex-col gap-3">
            {vocab.length === 0 && (
              <p className="text-center text-[#A8A5A1] font-serif italic mt-12">
                Words you save while reading will live here.
              </p>
            )}
            {vocab.map((v) => (
              <div
                key={v.vocab_id}
                className="bg-white border border-[#EAE6E1] rounded-2xl p-4"
                data-testid={`vocab-${v.vocab_id}`}
              >
                <div className="font-serif text-2xl text-[#2C2A29]">{v.word}</div>
                {v.meaning && <p className="text-sm text-[#787571] mt-1">{v.meaning}</p>}
                {v.page && (
                  <div className="text-[10px] tracking-[0.2em] uppercase text-[#A8A5A1] mt-2">
                    Page {v.page}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "insights" && (
          <div className="mt-6 flex flex-col gap-4">
            {insights.length === 0 && (
              <p className="text-center text-[#A8A5A1] font-serif italic mt-12">
                Insights unlocked from other readers will gather here, book by book.
              </p>
            )}
            {insights.map((g) => (
              <div key={g.book.book_id} className="bg-white border border-[#EAE6E1] rounded-2xl p-4">
                <div className="font-serif text-xl">{g.book.title}</div>
                <div className="mt-3 flex flex-col gap-3">
                  {g.highlights.map((h) => (
                    <div key={h.highlight_id} className="border-l-2 border-[#C86A58]/40 pl-3">
                      <p className="font-serif italic text-[#2C2A29]">&ldquo;{h.text}&rdquo;</p>
                      <div className="text-[10px] tracking-[0.2em] uppercase text-[#A8A5A1] mt-1">
                        {h.user_name} · p. {h.page}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={logout}
          data-testid="personal-logout"
          className="mt-10 w-full text-sm text-[#A8A5A1] hover:text-[#787571]"
        >
          {guest ? "Reset device session" : "Sign out"}
        </button>
        {guest && (
          <button
            onClick={() => setUpgradeOpen(true)}
            data-testid="personal-create-account"
            className="mt-3 w-full text-sm text-[#C86A58] hover:text-[#B35A4A] font-medium"
          >
            Create an account to sync
          </button>
        )}
      </div>
      <BottomTabBar />
      <UpgradeSheet
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        returnPath="/app/personal"
        context="your reflections, saved words and reading"
      />
    </MobileShell>
  );
}
