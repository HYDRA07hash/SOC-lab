/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0B1220',
          card: '#111827',
          cyan: '#00D4FF',
          green: '#00FF99',
          orange: '#FFA500',
          red: '#FF3B30',
          gray: '#1F2937',
          text: '#E5E7EB',
          muted: '#9CA3AF',
        }
      },
      fontFamily: {
        mono: ['Courier New', 'Courier', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 10px rgba(0, 212, 255, 0.3)',
        'glow-green': '0 0 10px rgba(0, 255, 153, 0.3)',
        'glow-red': '0 0 10px rgba(255, 59, 48, 0.3)',
      }
    },
  },
  plugins: [],
}
