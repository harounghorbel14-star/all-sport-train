"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import Link from "next/link";
import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export { cx } from "@/lib/cx";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-strong shadow-[0_8px_24px_-10px_var(--accent)]",
  secondary: "bg-surface-3 text-fg hover:bg-line",
  ghost: "bg-transparent text-fg hover:bg-surface-2",
  danger: "bg-danger/15 text-danger hover:bg-danger/25",
  outline: "border border-line bg-transparent text-fg hover:border-accent hover:text-accent",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-base gap-2 rounded-xl",
  xl: "h-16 px-7 text-lg gap-3 rounded-2xl",
};

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </motion.button>
  );
});

export function ButtonLink({ href, variant = "primary", size = "md", className, icon, children, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link href={href} className={cx("inline-flex items-center justify-center font-semibold transition-all hover:-translate-y-px active:scale-[0.97]", variants[variant], sizes[size], className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export function Card({ className, children, interactive, ...rest }: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card sm:p-5",
        interactive && "transition-all hover:-translate-y-0.5 hover:border-accent/50",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, action, icon, className }: { children: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
        {icon}
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "danger" | "warn" | "info" | "success"; className?: string }) {
  const tones = {
    neutral: "bg-surface-3 text-muted",
    accent: "bg-accent-soft text-accent",
    danger: "bg-danger/15 text-danger",
    warn: "bg-warn/15 text-warn",
    info: "bg-info/15 text-info",
    success: "bg-success/15 text-success",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function Chip({ selected, onClick, children, className, disabled }: { selected?: boolean; onClick?: () => void; children: ReactNode; className?: string; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40",
        selected ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface-2 text-fg hover:border-subtle",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

const inputBase =
  "w-full rounded-xl border border-line bg-surface-2 px-3.5 text-fg placeholder:text-subtle transition-colors focus:border-accent focus:outline-none disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, "h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputBase, "min-h-24 py-3", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(inputBase, "h-11 appearance-none bg-[length:12px] pe-8", className)} {...rest}>
      {children}
    </select>
  );
});

export function Field({ label, hint, error, children, htmlFor, optional }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string; optional?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-medium text-fg">
        {label}
        {optional && <span className="text-xs font-normal text-subtle">Optional</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-subtle">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; id?: string }) {
  // The switch is named and described explicitly; a wrapping <label> alone doesn't name a button for every screen reader.
  const auto = useId();
  const labelId = `${id ?? auto}-label`;
  const descId = `${id ?? auto}-desc`;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span id={labelId} className="block text-sm font-medium">{label}</span>
        {description && <span id={descId} className="block text-xs text-subtle">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        onClick={() => onChange(!checked)}
        className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-surface-3")}
      >
        <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 35 }} className={cx("absolute top-1 size-5 rounded-full bg-white shadow", checked ? "end-1" : "start-1")} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string; label?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cx("inline-flex rounded-xl bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx("relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", value === o.value ? "text-accent-fg" : "text-muted hover:text-fg")}
        >
          {value === o.value && <motion.span layoutId={`seg-${label ?? "x"}`} className="absolute inset-0 rounded-lg bg-accent" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</div>}
      <h3 className="font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-semibold underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton rounded-xl", className)} />;
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>}
        <h1 className="num text-4xl font-bold uppercase leading-none sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Stat({ label, value, unit, hint, className }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="num text-3xl font-bold">{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children, icon }: { tone?: "info" | "warn" | "accent" | "danger"; children: ReactNode; icon?: ReactNode }) {
  const tones = { info: "border-info/30 bg-info/10", warn: "border-warn/30 bg-warn/10", accent: "border-accent/30 bg-accent-soft", danger: "border-danger/30 bg-danger/10" };
  return <div className={cx("flex gap-3 rounded-xl border p-3 text-sm text-fg", tones[tone])}>{icon && <span className="mt-0.5 shrink-0">{icon}</span>}<div>{children}</div></div>;
}
