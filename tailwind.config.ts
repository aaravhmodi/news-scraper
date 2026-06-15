import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "oklch(0.22 0.035 215)",
        paper: "oklch(0.97 0.014 180)",
        panel: "oklch(0.995 0.004 180)",
        line: "oklch(0.88 0.018 200)",
        muted: "oklch(0.42 0.035 215)",
        accent: "oklch(0.43 0.085 205)",
        accentSoft: "oklch(0.93 0.035 200)",
        caution: "oklch(0.57 0.11 78)"
      },
      boxShadow: {
        soft: "0 4px 8px rgb(24 56 67 / 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
