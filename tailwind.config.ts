import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        calm: "0 24px 80px rgba(0, 0, 0, 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
