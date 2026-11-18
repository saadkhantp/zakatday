/** @type {import('tailwindcss').Config} */
/* Aligned with ayahday/tailwind.config.js (solar tokens, smooth easing, animate plugin).
   Color values live in src/styles/tokens.css. This file only points at them. */
const tailwindcssAnimate = require("tailwindcss-animate");

const channel = (token) => `rgb(var(${token}) / <alpha-value>)`;

function scale(prefix, steps) {
  const stops = steps || [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const colors = {};
  for (const step of stops) colors[step] = channel(`--${prefix}-${step}`);
  return colors;
}

const SOLAR_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./faq/index.html",
    "./app.js",
    "./currency-service.js",
    "./zakat-engine.js",
    "./theme.js",
    "./theme-init.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Mulish"', "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        white: channel("--white"),
        black: channel("--black"),
        slate: scale("slate"),
        sky: scale("sky"),
        rose: scale("rose"),
        emerald: scale("emerald"),
        amber: scale("amber"),
        cyan: scale("cyan"),
        solar: {
          green: Object.assign(scale("emerald", SOLAR_STEPS), {
            50: channel("--solar-green-50"),
          }),
          blue: scale("sky", SOLAR_STEPS),
          slate: scale("slate", SOLAR_STEPS),
          gold: {
            DEFAULT: channel("--solar-gold"),
            ink: channel("--solar-gold-ink"),
          },
          teal: channel("--solar-teal"),
        },
        whatsapp: {
          DEFAULT: channel("--whatsapp"),
          hover: channel("--whatsapp-hover"),
          pressed: channel("--whatsapp-pressed"),
        },
        /* Preflight placeholder color. Same value Tailwind used as gray-400. */
        gray: {
          400: channel("--gray-400"),
        },
      },
      ringColor: {
        DEFAULT: ({ opacityValue }) =>
          opacityValue === undefined
            ? "hsl(var(--ring))"
            : `hsl(var(--ring) / ${opacityValue})`,
      },
      ringOffsetColor: {
        DEFAULT: "rgb(var(--white))",
      },
      borderColor: {
        DEFAULT: "hsl(var(--border) / <alpha-value>)",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(var(--black) / 0.05)",
        lg: "0 10px 15px -3px rgb(var(--black) / 0.1), 0 4px 6px -4px rgb(var(--black) / 0.1)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
        "smooth-in": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        verse: "420ms",
        ui: "280ms",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        cardFadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        verseIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        modalIn: {
          from: { opacity: "0", transform: "translateY(12px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        meterGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgb(var(--solar-teal) / 0.55)" },
          "50%": { boxShadow: "0 0 18px 2px rgb(var(--solar-teal) / 0.45)" },
        },
        savedMenuPulse: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.14)" },
        },
        /* Summary / result refreshes and the "Check your Zakat" confirmation. */
        textFade: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        cardFlash: {
          "0%": { boxShadow: "0 0 0 0 rgb(var(--sky-500) / 0.55)" },
          "45%": { boxShadow: "0 0 0 6px rgb(var(--sky-500) / 0.18)" },
          "100%": { boxShadow: "0 0 0 0 rgb(var(--sky-500) / 0)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "card-fade-in": "cardFadeIn 0.2s ease-out forwards",
        "verse-in": "verseIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "modal-in": "modalIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "list-item-in": "verseIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "meter-glow": "meterGlow 2.6s cubic-bezier(0.22, 1, 0.36, 1) infinite",
        "saved-menu-pulse": "savedMenuPulse 0.6s cubic-bezier(0.22, 1, 0.36, 1) 2",
        "text-fade": "textFade 0.32s ease-out",
        "card-flash": "cardFlash 0.9s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
