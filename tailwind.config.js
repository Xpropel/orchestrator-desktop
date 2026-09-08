/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        panel: 'var(--bg-panel)',
        elevated: 'var(--bg-elevated)',
        border: 'var(--border)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        accent: 'var(--accent)'
      },
      spacing: {
        toolbar: '36px'
      }
    }
  },
  plugins: []
}
