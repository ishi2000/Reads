import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { startGoogleLogin, useAuth } from "../lib/auth";
import MobileShell from "../components/MobileShell";

const HERO = "https://static.prod-images.emergentagent.com/jobs/5d657e1f-df39-4855-bbe9-14b5ed0639a0/images/18af3646daa1ba51e553ff3163b4f1569c267ce342e14d2a99c82702f33f394e.png";

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const startCircle = () => {
    if (user) navigate("/create-circle");
    else startGoogleLogin("/create-circle");
  };
  const startSolo = () => {
    if (user) navigate("/create-solo");
    else startGoogleLogin("/create-solo");
  };

  return (
    <MobileShell>
      <div className="flex flex-col min-h-[100dvh]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative h-[45vh] overflow-hidden rounded-b-[2rem]"
      >
        <img src={HERO} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F9F8F6] via-transparent to-transparent" />
        <div className="absolute top-6 left-6 text-[10px] tracking-[0.3em] uppercase text-[#2C2A29]/70 font-sans">
          Cosift
        </div>
      </motion.div>

      <div className="px-7 pt-8 pb-32 flex-1 flex flex-col">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-serif text-[44px] leading-[1.05] tracking-tight text-[#2C2A29]"
          data-testid="landing-headline"
        >
          Begin your<br />
          <em className="not-italic font-medium">Reading Journey</em>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-4 text-[#787571] text-base leading-relaxed"
        >
          A quiet layer of shared thinking, woven into the pages you turn.
          Sift meaning from what you read &mdash; together.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 flex flex-col gap-3"
        >
          <button
            onClick={startCircle}
            data-testid="cta-start-circle"
            className="w-full bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full py-4 text-base font-medium transition-colors text-center shadow-sm"
          >
            Start a Reading Circle
          </button>
          <button
            onClick={() => navigate("/join")}
            data-testid="cta-join-link"
            className="w-full bg-white border border-[#EAE6E1] hover:bg-stone-50 text-[#2C2A29] rounded-full py-4 text-base font-medium transition-colors text-center"
          >
            Join via Link
          </button>
          <button
            onClick={startSolo}
            data-testid="cta-solo-session"
            className="w-full text-[#787571] hover:text-[#2C2A29] rounded-full py-4 text-base font-medium transition-colors text-center"
          >
            Start a Solo Session
          </button>
        </motion.div>

        {user && (
          <button
            onClick={() => navigate("/app/reads")}
            data-testid="continue-reading"
            className="mt-8 text-center text-sm font-sans text-[#C86A58] underline-offset-4 hover:underline"
          >
            Continue where you left off, {user.name?.split(" ")[0]}
          </button>
        )}
      </div>
    </div>
    </MobileShell>
  );
}
