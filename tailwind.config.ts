import type { Config } from "tailwindcss";
const defaultTheme = require("tailwindcss/defaultTheme");
const colors = require("tailwindcss/colors");
const {
  default: flattenColorPalette,
} = require("tailwindcss/lib/util/flattenColorPalette");

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        neutral: colors.neutral,
        canvas: "#050a12",
        canvasDeep: "#03070d",
        surface1: "#141414",
        surface2: "#1c1c1c",
        hairline: "#262626",
        hairlineSoft: "#1a1a1a",
        ink: "#ffffff",
        inkMuted: "#a9c4dc",
        inkFaint: "#8aa8c2",
        accent: "#3aa9ff",
        accentInk: "#04121f",
        accentBlue: "#3aa9ff",
        foil: {
          900: "#071a2e",
          700: "#0b3356",
          500: "#10598f",
          300: "#2a9ad6",
          200: "#4fc8ea",
          100: "#86e6dd",
        },
        riskCritical: "#ef4444",
        riskCriticalBg: "rgba(239, 68, 68, 0.1)",
        riskCriticalBorder: "rgba(239, 68, 68, 0.3)",
        riskCriticalDarkBg: "#7f1d1d",
        riskCriticalDarkText: "#fca5a5",
        riskWarning: "#f59e0b",
        riskWarningOrange: "#fb923c",
        riskWarningBg: "rgba(249, 115, 22, 0.1)",
        riskWarningBorder: "rgba(249, 115, 22, 0.2)",
        riskNormal: "#22c55e",
        riskNormalLight: "#4ade80",
        riskNormalBg: "rgba(34, 197, 94, 0.15)",
        riskNormalBorder: "rgba(34, 197, 94, 0.3)",
      },
      fontFamily: {
        sans: ["var(--font-text)", "var(--font-inter)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-display)", "var(--font-inter)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-fira-code)", ...defaultTheme.fontFamily.mono],
      },
      borderRadius: {
        xs: "5px",
        sm: "8px",
        md: "11px",
        lg: "18px",
        xl: "20px",
        "2xl": "30px",
        pill: "9999px",
      },
      spacing: {
        xxs: "4px",
        xs: "8px",
        sm: "12px",
        md: "17px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
        section: "80px",
      },
      animation: {
        spotlight: "spotlight 2s ease .75s 1 forwards",
        scroll:
          "scroll var(--animation-duration, 40s) var(--animation-direction, forwards) linear infinite",
        shimmer: "shimmer 2s linear infinite",
        meteor: "meteor 5s linear infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        slideUp: "slideUp 50s linear infinite",
        slideDown: "slideDown 60s linear infinite",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-50%)" },
        },
        slideDown: {
          "0%": { transform: "translateY(-50%)" },
          "100%": { transform: "translateY(0)" },
        },
        spotlight: {
          "0%": {
            opacity: "0",
            transform: "translate(-72%, -62%) scale(0.5)",
          },
          "100%": {
            opacity: "1",
            transform: "translate(-50%,-40%) scale(1)",
          },
        },
        scroll: {
          to: {
            transform: "translate(calc(-50% - 0.5rem))",
          },
        },
        shimmer: {
          from: {
            backgroundPosition: "0 0",
          },
          to: {
            backgroundPosition: "-200% 0",
          },
        },
        meteor: {
          "0%": { transform: "rotate(215deg) translateX(0)", opacity: "1" },
          "70%": { opacity: "1" },
          "100%": {
            transform: "rotate(215deg) translateX(-500px)",
            opacity: "0",
          },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
    },
  },
  plugins: [addVariablesForColors],
};

function addVariablesForColors({ addBase, theme }: any) {
  let allColors = flattenColorPalette(theme("colors"));
  let newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val])
  );

  addBase({
    ":root": newVars,
  });
}

export default config;
