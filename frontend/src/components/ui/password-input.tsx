"use client";

import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={show ? "text" : "password"}
          className={className}
          autoComplete={props.autoComplete ?? "current-password"}
          {...props}
        />
        <button
          type="button"
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground transition-colors"
          onClick={() => setShow((v) => !v)}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
