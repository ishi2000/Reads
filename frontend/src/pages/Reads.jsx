import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, LogOut } from "lucide-react";
import MobileShell from "../components/MobileShell";
import BottomTabBar from "../components/BottomTabBar";
import BookCard from "../components/BookCard";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const EMPTY_ART = "https://static.prod-images.emergentagent.com/jobs/5d657e1f-df39-4855-bbe9-14b5ed0639a0/images/962321ba0c250a9ae81bbe2a5b3dcbf066fa04dd63f95c71b772ac00eda2f92d.png";

export default function Reads() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [circles, setCircles] = useState([]);
  const [soloBooks, setSoloBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/circles"), api.get("/books/solo")])
      .then(([c, s]) => {
        if (!active) return;
        setCircles(c.data || []);
        setSoloBooks(s.data || []);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const circleBooks = circles.flatMap((c) => (c.books || []).map((b) => ({ ...b, circleName: c.name })));
  const inProgress = circleBooks.filter((b) => (b.my_progress?.current_page || 0) > 0);
  const nextReads = circleBooks.filter((b) => (b.my_progress?.current_page || 0) === 0);
  const completed = circleBooks.filter(
    (b) => b.total_pages > 0 && (b.my_progress?.current_page || 0) >= b.total_pages,
  );

  const soloIn = soloBooks.filter((b) => (b.my_progress?.current_page || 0) > 0);
  const soloNext = soloBooks.filter((b) => (b.my_progress?.current_page || 0) === 0);

  const Section = ({ title, items, hint, testid }) =>
    items.length > 0 && (
      <div className="mt-8" data-testid={testid}>
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h3 className="text-[10px] tracking-[0.25em] uppercase text-[#A8A5A1] font-sans">
            {title}
          </h3>
          {hint && <span className="text-[10px] text-[#A8A5A1]">{hint}</span>}
        </div>
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          className="flex flex-col gap-3"
        >
          {items.map((b) => (
            <motion.div
              key={b.book_id}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
              }}
            >
              <BookCard book={b} circleName={b.circleName} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    );

  const hasAnything =
    inProgress.length + nextReads.length + completed.length + soloIn.length + soloNext.length > 0;

  return (
    <MobileShell>
      <div className="px-6 pt-10 pb-32">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-[#A8A5A1]">Cosift</div>
            <h1 className="font-serif text-[40px] leading-[1.05] tracking-tight mt-1">
              Reads
            </h1>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/create-circle")}
                data-testid="new-circle-btn"
                className="w-10 h-10 rounded-full bg-[#2C2A29] text-white flex items-center justify-center"
              >
                <Plus strokeWidth={2} className="w-4 h-4" />
              </button>
              <button
                onClick={logout}
                data-testid="logout-btn"
                className="w-10 h-10 rounded-full border border-[#EAE6E1] text-[#787571] flex items-center justify-center"
                title="Log out"
              >
                <LogOut strokeWidth={1.5} className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {loading && (
          <p className="mt-12 text-center text-[#A8A5A1] font-serif italic">
            Gathering your books&hellip;
          </p>
        )}

        {!loading && !hasAnything && (
          <div className="mt-16 flex flex-col items-center text-center">
            <img src={EMPTY_ART} alt="" className="w-44 h-44 object-contain opacity-80" />
            <p className="font-serif italic text-xl text-[#787571] mt-6">
              Your shelf is quiet.
            </p>
            <p className="text-sm text-[#A8A5A1] mt-2 max-w-xs">
              Start a circle or a solo session to begin your reading journey.
            </p>
            <button
              onClick={() => navigate("/create-circle")}
              data-testid="empty-create-circle"
              className="mt-8 bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full px-6 py-3 font-medium"
            >
              Start a Reading Circle
            </button>
            <button
              onClick={() => navigate("/create-solo")}
              data-testid="empty-create-solo"
              className="mt-2 text-sm text-[#787571]"
            >
              or read solo
            </button>
          </div>
        )}

        <div>
          {(inProgress.length + nextReads.length + completed.length > 0) && (
            <h2 className="font-serif text-2xl mt-10 text-[#2C2A29]">Reading Circles</h2>
          )}
          <Section title="Continue Reading" items={inProgress} testid="circle-continue" />
          <Section title="Next Reads" items={nextReads} testid="circle-next" />
          <Section title="Completed Journeys" items={completed} testid="circle-completed" />

          {(soloIn.length + soloNext.length > 0) && (
            <h2 className="font-serif text-2xl mt-12 text-[#2C2A29]">Solo Reading</h2>
          )}
          <Section title="Continue Reading" items={soloIn} testid="solo-continue" />
          <Section title="Next Reads" items={soloNext} testid="solo-next" />

          {hasAnything && (
            <button
              onClick={() => navigate("/create-solo")}
              data-testid="add-solo-book"
              className="mt-10 w-full border border-dashed border-[#EAE6E1] rounded-2xl py-4 text-[#787571] hover:bg-white hover:border-[#C86A58] transition-colors"
            >
              + Add a solo book
            </button>
          )}
        </div>
      </div>
      <BottomTabBar />
    </MobileShell>
  );
}
