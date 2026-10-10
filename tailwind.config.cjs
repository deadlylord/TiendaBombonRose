module.exports = {
  content: ['./index.html', './App.tsx', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
        'primary-light': '#f472b6',
        'primary-dark': '#db2777',
        background: '#ffffff',
        surface: '#f9fafb',
        'on-surface': '#1f2937',
        secondary: '#880e4f',
        accent: '#d4a017',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
    },
  },
};
