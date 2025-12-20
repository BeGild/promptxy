import { heroui } from "@heroui/react";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            background: "#1e1e1e",
            foreground: "#e0e0e0",
            primary: {
              50: "#e6f3ff",
              100: "#cce6ff",
              200: "#99ccff",
              300: "#66b3ff",
              400: "#3399ff",
              500: "#007acc",
              600: "#0066b3",
              700: "#005599",
              800: "#004477",
              900: "#003355",
              DEFAULT: "#007acc",
            },
          },
        },
      },
    }),
  ],
};
