import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function Card({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return <section className={cn("rounded-xl border border-line bg-panel p-5 shadow-soft", className)} {...props}>{children}</section>;
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" }) {
  const tones = {
    slate: "border-line bg-paper text-muted",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-rose-200 bg-rose-50 text-rose-800",
    blue: "border-sky-200 bg-accentSoft text-accent"
  };
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function Button({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
