import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary border-primary" : "bg-surface-container border-border",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-[18px]" : "translate-x-[2px]",
        )}
      />
    </button>
  ),
);
Switch.displayName = "Switch";
