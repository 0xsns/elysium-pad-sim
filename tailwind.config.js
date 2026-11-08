/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#05070a",
        panel: "#0a0f14",
        line: "#16232e",
        teal: "#40ffd0",
        mint: "#7dffb2",
        coral: "#ff5c72",
        amber: "#ffb020",
        dim: "#94aab8",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
