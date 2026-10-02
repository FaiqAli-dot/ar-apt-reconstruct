/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--color-ink)",
          soft: "var(--color-ink-soft)",
          muted: "var(--color-ink-muted)",
        },
        cream: {
          DEFAULT: "var(--color-cream)",
          soft: "var(--color-cream-soft)",
          deep: "var(--color-cream-deep)",
        },
        copper: {
          DEFAULT: "var(--color-copper)",
          soft: "var(--color-copper-soft)",
          deep: "var(--color-copper-deep)",
        },
        line: "var(--color-line)",
        success: "var(--color-success)",
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 18px 50px rgba(15, 20, 25, 0.12)",
        soft: "0 8px 24px rgba(15, 20, 25, 0.08)",
      },
      backgroundImage: {
        "ink-wash":
          "radial-gradient(ellipse at 20% 0%, rgba(196, 120, 59, 0.18), transparent 45%), radial-gradient(ellipse at 90% 10%, rgba(255, 248, 237, 0.08), transparent 35%), linear-gradient(165deg, #0F1419 0%, #161C24 48%, #1A1510 100%)",
        "cream-wash":
          "radial-gradient(ellipse at top right, rgba(196, 120, 59, 0.08), transparent 40%), linear-gradient(180deg, #FBF7F0 0%, #F3EBE0 100%)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s ease-out both",
        "fade-in": "fade-in 0.35s ease-out both",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
