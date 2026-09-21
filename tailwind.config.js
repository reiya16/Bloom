/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"]
      },
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          2: "rgb(var(--surface-2) / <alpha-value>)",
          3: "rgb(var(--surface-3) / <alpha-value>)",
          4: "rgb(var(--surface-4) / <alpha-value>)"
        },
        line: {
          DEFAULT: "var(--line)",
          2: "var(--line-2)",
          3: "var(--line-3)"
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          2: "rgb(var(--ink-2) / <alpha-value>)",
          3: "rgb(var(--ink-3) / <alpha-value>)",
          4: "rgb(var(--ink-4) / <alpha-value>)"
        },
        plum: {
          DEFAULT: "rgb(var(--plum) / <alpha-value>)",
          bg: "rgb(var(--plum-bg) / <alpha-value>)"
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          bg: "var(--accent-bg)",
          border: "var(--accent-border)",
          ink: "rgb(var(--accent-ink) / <alpha-value>)"
        },
        success: {
          DEFAULT: "rgb(var(--success) / <alpha-value>)",
          bg: "var(--success-bg)"
        },
        danger: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          bg: "var(--danger-bg)"
        },
        warn: {
          DEFAULT: "rgb(var(--warn) / <alpha-value>)",
          bg: "var(--warn-bg)"
        }
      },
      borderRadius: {
        card: "16px",
        md2: "14px",
        sm2: "8px"
      }
    }
  },
  plugins: []
};
