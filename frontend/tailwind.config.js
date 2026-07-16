/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#4f6ef7",
          600: "#3f57e0",
          700: "#3446b8",
        },
      },
    },
  },
  plugins: [],
};
