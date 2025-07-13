/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <- wichtig
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
