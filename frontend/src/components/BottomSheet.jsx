import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function BottomSheet({ open, onClose, title, children, testid = "bottom-sheet" }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 z-[55]"
            onClick={onClose}
            data-testid={`${testid}-overlay`}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed inset-x-0 bottom-0 max-w-md mx-auto bg-[#FCFBF9] rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] border-t border-[#EAE6E1] p-6 z-[60] flex flex-col max-h-[80dvh]"
            data-testid={testid}
          >
            <div className="mx-auto w-10 h-1 bg-[#EAE6E1] rounded-full mb-4" />
            {title && (
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-2xl text-[#2C2A29]">{title}</h3>
                <button
                  onClick={onClose}
                  className="text-[#A8A5A1] hover:text-[#2C2A29] p-1"
                  data-testid={`${testid}-close`}
                >
                  <X strokeWidth={1.5} className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
