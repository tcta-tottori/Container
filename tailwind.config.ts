import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // 端末の UI と同じ書体（globals.css の --font-ui と合わせる）
        sans: ["var(--font-ui)"],
      },
    },
  },
  plugins: [],
};
export default config;
