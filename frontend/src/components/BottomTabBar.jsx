import React from "react";
import { NavLink } from "react-router-dom";
import { BookOpen, Activity, User } from "lucide-react";

const tabs = [
  { to: "/app/reads", label: "Reads", icon: BookOpen, testid: "tab-reads" },
  { to: "/app/turns", label: "Turns", icon: Activity, testid: "tab-turns" },
  { to: "/app/personal", label: "Personal", icon: User, testid: "tab-personal" },
];

export default function BottomTabBar() {
  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md glass border-t border-[#EAE6E1] flex justify-around items-start px-2 pt-2 z-40"
      style={{
        // Respect iPhone safe-area + reserve extra space so the rightmost
        // Personal tab is never overlapped by the preview "Made with Emergent"
        // badge (BUG-009).
        paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.75rem))",
        minHeight: "72px",
      }}
    >
      {tabs.map(({ to, label, icon: Icon, testid }) => (
        <NavLink
          key={to}
          to={to}
          data-testid={testid}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              isActive ? "text-[#C86A58]" : "text-[#A8A5A1] hover:text-[#787571]"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon strokeWidth={isActive ? 2 : 1.5} className="w-5 h-5" />
              <span className="text-[10px] tracking-[0.18em] uppercase font-sans">
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}
