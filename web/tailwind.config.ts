import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // SJSU brand-ish palette
        sjsu: { blue: "#0055A2", gold: "#E5A823" },
      },
    },
  },
  plugins: [],
};

export default config;
