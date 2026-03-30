/** @type {import('tailwindcss').Config} */
const { fontFamily } = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./src/**/*.{html,js,ts,jsx,tsx}"], // ← add .ts/.tsx if missing
  theme: {
    fontFamily: {
      sans: ["Graphik", "sans-serif"],
      serif: ["Merriweather", "serif"],
    },
    extend: {
      fontFamily: {
        cascadia: ['"Cascadia Code"', ...fontFamily.sans], // ← quotes are important!
        // or more safely:
        // cascadia: ['"Cascadia Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
      },
      // ... your other extensions
    },
  },
  // plugins: [],
};
