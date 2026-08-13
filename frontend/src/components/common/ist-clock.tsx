"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";

export function ISTClock({ className }: { className?: string }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      setTime(formatInTimeZone(new Date(), "Asia/Kolkata", "HH:mm:ss") + " IST");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={cn("tabular-nums text-sm text-muted-foreground", className)} aria-live="polite">
      {time || "--:--:-- IST"}
    </span>
  );
}
