import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mountain: {
          navy: '#0F172A',
          ice: '#22D3EE',
          powder: '#FFFFFF',
          danger: '#EF4444',
          warning: '#F59E0B',
          success: '#10B981',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'snowfall': 'snowfall 3s ease-in-out infinite',
      },
      keyframes: {
        snowfall: {
          '0%, 100%': { transform: 'translateY(0px)', opacity: '1' },
          '50%': { transform: 'translateY(10px)', opacity: '0.7' },
        }
      }
    },
  },
  plugins: [],
};

export default config;
