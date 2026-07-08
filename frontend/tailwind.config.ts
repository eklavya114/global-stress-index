import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Pulse score gradient palette
        "pulse-low":    "#16a34a",
        "pulse-medium": "#ca8a04",
        "pulse-high":   "#dc2626",
        "panel-bg":     "#0f172a",
        "panel-border": "#1e293b",
      },
    },
  },
  plugins: [],
};

export default config;
