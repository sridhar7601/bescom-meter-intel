import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        tremor: {
          brand: { faint: "#fef9c3", muted: "#fde047", subtle: "#eab308", DEFAULT: "#ca8a04" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
