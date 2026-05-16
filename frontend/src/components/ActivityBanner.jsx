import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function ActivityBanner({ message, visible }) {
  return (
    <AnimatePresence>
      {visible && message && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="absolute top-20 left-4 right-4 glass border border-[#EAE6E1] shadow-sm rounded-full py-3 px-5 flex items-center gap-3 z-40"
          data-testid="activity-banner"
        >
          <Sparkles strokeWidth={1.5} className="w-4 h-4 text-[#C86A58] flex-shrink-0" />
          <span className="text-sm font-sans text-[#2C2A29] truncate">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
