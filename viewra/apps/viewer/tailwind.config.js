/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07080a",
          900: "#0c0e12",
          800: "#141820",
          700: "#1c2230",
          600: "#2a3344",
        },
        mist: {
          100: "#e8ebe8",
          200: "#c5cbc4",
          300: "#9aa39a",
          400: "#6f796f",
        },
        brass: {
          400: "#c4a574",
          500: "#a8895a",
        },
      },
      fontFamily: {
        display: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"Outfit"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      transitionDuration: {
        crossfade: "480ms",
      },
    },
  },
  plugins: [],
};
