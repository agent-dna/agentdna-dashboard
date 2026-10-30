import { useEffect, useRef, useState } from "react";

const LENGTH = 6;

/**
 * A 6-digit code field: one real input (so typing, paste and the phone's one-time-code autofill
 * all work) laid invisibly over six cells that show the digits. The value stays a string, so
 * leading zeros survive. `onComplete` fires once the sixth digit lands.
 */
export function OtpInput({ value, onChange, onComplete, disabled, invalid, autoFocus, size = "md" }: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  /** "sm": compact cells for use inside a longer form. */
  size?: "md" | "sm";
}) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  // Cleared after a wrong code: take focus back so the next try can be typed straight away.
  useEffect(() => {
    if (!disabled && value === "" && autoFocus) ref.current?.focus();
  }, [disabled, value, autoFocus]);
  const active = Math.min(value.length, LENGTH - 1);
  return (
    <div className={`otp${size === "sm" ? " otp-sm" : ""}${invalid ? " invalid" : ""}${disabled ? " disabled" : ""}`}>
      <input
        ref={ref}
        className="otp-input"
        value={value}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern={`\\d{${LENGTH}}`}
        maxLength={LENGTH}
        aria-label={`${LENGTH}-digit code`}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, LENGTH);
          onChange(v);
          if (v.length === LENGTH && v !== value) onComplete?.(v);
        }}
      />
      {Array.from({ length: LENGTH }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`otp-cell${value[i] ? " filled" : ""}${focused && !disabled && i === active ? " active" : ""}${i === LENGTH / 2 ? " split" : ""}`}
        >
          {value[i] ?? ""}
        </span>
      ))}
    </div>
  );
}
