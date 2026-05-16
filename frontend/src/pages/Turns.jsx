import React, { useEffect, useState } from "react";
import MobileShell from "../components/MobileShell";
import BottomTabBar from "../components/BottomTabBar";
import { api } from "../lib/api";
import { motion } from "framer-motion";
import { MessageSquare, Bookmark, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const iconFor = (type) => {
  if (type === "reply") return MessageSquare;
  if (type === "highlight") return Bookmark;
  return Sparkles;
};

export default function Turns() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/turns")
      .then((r) => setSections(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <MobileShell>
      <div className="px-6 pt-10 pb-32">
        <div className="text-[10px] tracking-[0.3em] uppercase text-[#A8A5A1]">Asynchronous</div>
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-tight mt-1">Turns</h1>
        <p className="text-[#787571] mt-2 text-sm">Quiet movement across your circles.</p>

        {loading && (
          <p className="mt-12 text-center text-[#A8A5A1] font-serif italic">Listening&hellip;</p>
        )}

        {!loading && sections.length === 0 && (
          <p className="mt-16 text-center text-[#787571] font-serif italic">
            No circles yet. Start one to see shared turns appear here.
          </p>
        )}

        {sections.map((s) => {
          const totalPages = s.books.reduce((a, b) => a + (b.total_pages || 0), 0);
          return (
            <div key={s.circle.circle_id} className="mt-10" data-testid={`turn-section-${s.circle.circle_id}`}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-2xl text-[#2C2A29]">{s.circle.name}</h2>
                <span className="text-xs text-[#A8A5A1]">{s.members.length} readers</span>
              </div>

              {/* Member progression line */}
              <div className="mt-4 bg-white border border-[#EAE6E1] rounded-2xl p-4">
                <div className="text-[10px] tracking-[0.2em] uppercase text-[#A8A5A1] mb-3">
                  Group progression
                </div>
                <div className="relative h-2 bg-stone-100 rounded-full">
                  {s.members.map((m, i) => {
                    const pct = totalPages > 0 ? Math.min(100, (m.pages_read / totalPages) * 100) : 0;
                    return (
                      <div
                        key={m.user_id}
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                        style={{
                          left: `calc(${pct}% - 6px)`,
                          background: `hsl(${(i * 60) % 360} 45% 55%)`,
                        }}
                        title={`${m.name}: ${m.pages_read} pages`}
                      />
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                  {s.members.map((m, i) => (
                    <div key={m.user_id} className="flex items-center gap-1 text-xs text-[#787571]">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: `hsl(${(i * 60) % 360} 45% 55%)` }}
                      />
                      {m.name} · {m.pages_read}p
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity */}
              <div className="mt-6 flex flex-col">
                {s.activity.length === 0 && (
                  <p className="text-sm text-[#A8A5A1] font-serif italic">No turns yet on pages you&rsquo;ve reached.</p>
                )}
                {s.activity.map((a, idx) => {
                  const Icon = iconFor(a.type);
                  return (
                    <motion.div
                      key={a.activity_id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: idx * 0.04 }}
                      className="flex gap-3 pb-5 relative"
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full bg-white border border-[#EAE6E1] flex items-center justify-center">
                          <Icon strokeWidth={1.5} className="w-3.5 h-3.5 text-[#C86A58]" />
                        </div>
                        {idx < s.activity.length - 1 && (
                          <div className="w-px flex-1 bg-[#EAE6E1] mt-1" />
                        )}
                      </div>
                      <div className="flex-1 -mt-0.5">
                        <div className="text-sm text-[#2C2A29]">
                          <span className="font-medium">{a.user_name}</span>{" "}
                          {a.type === "reply" ? "replied to a thread" : "highlighted a passage"} on
                          page {a.page} of{" "}
                          <em className="font-serif">{a.book_title}</em>
                        </div>
                        <p className="mt-1 text-sm text-[#787571] font-serif italic line-clamp-2">
                          &ldquo;{a.preview}&rdquo;
                        </p>
                        <button
                          onClick={() => navigate(`/read/${a.book_id}?page=${a.page}`)}
                          className="mt-1 text-xs text-[#C86A58] hover:underline"
                          data-testid={`open-activity-${a.activity_id}`}
                        >
                          Open passage
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <BottomTabBar />
    </MobileShell>
  );
}
