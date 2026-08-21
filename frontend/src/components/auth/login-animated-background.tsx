"use client";

import { useReducedMotion } from "framer-motion";
import type { CSSProperties } from "react";
import { ArrowUpRight, CircleDollarSign, Percent, TrendingUp } from "lucide-react";

const TREND_PATHS = [
  "M -80 640 C 220 560, 430 660, 720 540 S 1180 400, 1520 310",
  "M -80 250 C 250 330, 500 210, 800 290 S 1230 190, 1520 250",
  "M -80 780 C 300 730, 620 820, 960 710 S 1320 630, 1520 570",
];

const TRAVELER_DOTS = [
  { path: TREND_PATHS[0], dur: 30, begin: -4, color: "var(--primary-light)", hidden: "" },
  { path: TREND_PATHS[0], dur: 36, begin: -22, color: "var(--primary)", hidden: "login-hide-mobile" },
  { path: TREND_PATHS[1], dur: 26, begin: -9, color: "var(--accent-foreground)", hidden: "" },
  { path: TREND_PATHS[2], dur: 40, begin: -28, color: "var(--primary-light)", hidden: "login-hide-tablet" },
];

const NODES = [
  { left: "12%", top: "22%", delay: "0s", dur: "5s", hidden: "" },
  { left: "84%", top: "18%", delay: "-2.5s", dur: "6s", hidden: "" },
  { left: "8%", top: "66%", delay: "-1.2s", dur: "5.5s", hidden: "login-hide-mobile" },
  { left: "90%", top: "70%", delay: "-3.8s", dur: "4.8s", hidden: "login-hide-mobile" },
  { left: "24%", top: "86%", delay: "-0.6s", dur: "6s", hidden: "login-hide-tablet" },
];

const FLOATERS = [
  { Icon: TrendingUp, className: "right-[8%] top-[20%] h-11 w-11 opacity-[0.07] blur-[2px]", style: { animationDuration: "19s" }, hideOnMobile: true },
  { Icon: Percent, className: "left-[7%] top-[34%] h-8 w-8 opacity-[0.08] blur-[1px]", style: { animationDuration: "15s", animationDelay: "-7s" }, hideOnMobile: true },
  { Icon: CircleDollarSign, className: "left-[14%] bottom-[16%] h-9 w-9 opacity-[0.06] blur-[2px]", style: { animationDuration: "22s", animationDelay: "-3s" }, hideOnTablet: true },
  { Icon: ArrowUpRight, className: "right-[13%] bottom-[22%] h-7 w-7 opacity-[0.09] blur-[1px]", style: { animationDuration: "17s", animationDelay: "-11s" }, hideOnMobile: true },
];

export function LoginAnimatedBackground() {
  const reducedMotion = useReducedMotion();

  return (
    <div aria-hidden="true" className="login-bg">
      <div className="login-bg-grid" />

      <div className="login-glow login-glow-a" />
      <div className="login-glow login-glow-b" />

      <svg
        className="login-trends"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <linearGradient id="login-trend-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="0.2" stopColor="var(--primary)" stopOpacity="0.55" />
            <stop offset="0.8" stopColor="var(--primary)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="login-trends-drift">
          <path d={TREND_PATHS[0]} stroke="url(#login-trend-stroke)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="login-trend-breathe" />
          <path d={TREND_PATHS[1]} stroke="url(#login-trend-stroke)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="login-trend-breathe login-trend-breathe-delay" />
          <path d={TREND_PATHS[2]} stroke="url(#login-trend-stroke)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="login-hide-mobile login-trend-breathe" style={{ animationDelay: "-4s" }} />
        </g>
        {!reducedMotion &&
          TRAVELER_DOTS.map((dot, i) => (
            <g key={i} className={dot.hidden || undefined}>
              <animateMotion dur={`${dot.dur}s`} begin={`${dot.begin}s`} repeatCount="indefinite" path={dot.path} />
              <circle r="7" fill={dot.color} opacity="0.14" />
              <circle r="2.5" fill={dot.color} opacity="0.85" />
            </g>
          ))}
      </svg>

      {NODES.map((node, i) => (
        <span
          key={i}
          className={`login-node${node.hidden ? ` ${node.hidden}` : ""}`}
          style={
            {
              left: node.left,
              top: node.top,
              "--node-delay": node.delay,
              "--node-dur": node.dur,
            } as CSSProperties
          }
        />
      ))}

      {FLOATERS.map(({ Icon, className, style, hideOnMobile, hideOnTablet }, i) => {
        const hidden = [hideOnMobile && "login-hide-mobile", hideOnTablet && "login-hide-tablet"]
          .filter(Boolean)
          .join(" ");
        return (
          <span key={i} className={`login-float ${hidden} ${className}`} style={style}>
            <Icon />
          </span>
        );
      })}
    </div>
  );
}
