import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const COVERS = [
  "https://static.prod-images.emergentagent.com/jobs/5d657e1f-df39-4855-bbe9-14b5ed0639a0/images/43b39c95ae7df135476b53f1a15553f75fb2b4aea0f08db8f4d954a9b75e25f3.png",
  "https://static.prod-images.emergentagent.com/jobs/5d657e1f-df39-4855-bbe9-14b5ed0639a0/images/de0c690e7a00a066b5cefd3eb11ea719762da635e9aeee33d437e33d6eb7ff51.png",
  "https://static.prod-images.emergentagent.com/jobs/5d657e1f-df39-4855-bbe9-14b5ed0639a0/images/1e5f4ec205f7af332289a115e5b9dea3260ef47058fb3cc23c2d1cbd3285b658.png",
  "https://static.prod-images.emergentagent.com/jobs/5d657e1f-df39-4855-bbe9-14b5ed0639a0/images/fe0b5fa3f1ecef4388439b48aa658e5e2655242a06a610f92462ee26c40acc55.png",
];

function pickCover(seed) {
  if (!seed) return COVERS[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return COVERS[Math.abs(h) % COVERS.length];
}

export default function BookCard({ book, circleName }) {
  const navigate = useNavigate();
  const total = book.total_pages || book.my_progress?.total_pages || 0;
  const current = book.my_progress?.current_page || 0;
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const cover = pickCover(book.book_id);

  return (
    <motion.button
      onClick={() => navigate(`/read/${book.book_id}`)}
      whileTap={{ scale: 0.98 }}
      data-testid={`book-card-${book.book_id}`}
      className="w-full flex gap-4 bg-white p-4 rounded-2xl border border-[#EAE6E1] items-center text-left hover:shadow-sm transition-shadow"
    >
      <div className="w-16 h-24 rounded shadow-sm overflow-hidden flex-shrink-0 book-spine relative">
        <img src={cover} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        {circleName ? (
          <div className="text-[10px] tracking-[0.18em] uppercase text-[#A8A5A1] font-sans mb-1 truncate">
            {circleName}
          </div>
        ) : (
          <div className="text-[10px] tracking-[0.18em] uppercase text-[#A8A5A1] font-sans mb-1">
            Solo
          </div>
        )}
        <div className="font-serif text-xl text-[#2C2A29] leading-tight truncate">
          {book.title}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="h-1 flex-1 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C86A58]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-[#A8A5A1] tabular-nums">{pct}%</span>
        </div>
        <div className="mt-2 text-xs text-[#787571]">
          {current > 0 ? `Page ${current}${total ? ` of ${total}` : ""}` : "Not started yet"}
        </div>
      </div>
    </motion.button>
  );
}

export { pickCover };
