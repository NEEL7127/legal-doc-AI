/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./client/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "rgb(59 130 246)", // blue-500
        secondary: "rgb(168 85 247)", // purple-500
        background: "rgb(249 250 251)", // gray-50
        foreground: "rgb(15 23 42)", // gray-900
        border: "rgb(229 231 235)", // gray-200
        destructive: "rgb(239 68 68)", // red-500
      },
    },
  },
  plugins: [],
};

