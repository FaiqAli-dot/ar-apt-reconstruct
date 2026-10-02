/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          soft: "rgb(var(--color-ink-soft) / <alpha-value>)",
          muted: "rgb(var(--color-ink-muted) / <alpha-value>)",
        },
        cream: {
          DEFAULT: "rgb(var(--color-cream) / <alpha-value>)",
          soft: "rgb(var(--color-cream-soft) / <alpha-value>)",
          deep: "rgb(var(--color-cream-deep) / <alpha-value>)",
        },
        copper: {
          DEFAULT: "rgb(var(--color-copper) / <alpha-value>)",
          soft: "rgb(var(--color-copper-soft) / <alpha-value>)",
          deep: "rgb(var(--color-copper-deep) / <alpha-value>)",
        },
        line: "rgb(var(--color-line) / 0.1)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
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
