/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        casino: {
          green: '#0F4C3A',
          'green-light': '#2D5A47',
          black: '#1A1A1A',
          charcoal: '#2D2D2D',
          silver: '#C0C0C0',
          gold: '#FFD700',
          bronze: '#CD7F32',
          blue: '#1E40AF',
          purple: '#7C3AED',
          red: '#DC2626',
          yellow: '#F59E0B',
        },
        card: {
          red: '#DC2626',
          black: '#1F2937',
          background: '#FAFAFA',
        }
      },
      fontFamily: {
        'casino': ['Georgia', 'Times New Roman', 'serif'],
        'elegant': ['Playfair Display', 'serif'],
      },
      backgroundImage: {
        'felt-texture': "url('data:image/svg+xml,%3Csvg width=\"40\" height=\"40\" viewBox=\"0 0 40 40\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"0.02\"%3E%3Cpath d=\"m0 40l40-40v40zm40 0v-40l-40 40z\"/%3E%3C/g%3E%3C/svg%3E')",
      },
      boxShadow: {
        'casino': '0 4px 14px 0 rgba(0, 0, 0, 0.39)',
        'gold': '0 4px 14px 0 rgba(255, 215, 0, 0.3)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.15)',
      },
      animation: {
        'card-flip': 'flip 0.3s ease-in-out',
        'card-deal': 'deal 0.5s ease-out',
        'gold-shine': 'shine 2s linear infinite',
      },
      keyframes: {
        flip: {
          '0%': { transform: 'rotateY(0deg)' },
          '50%': { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        deal: {
          '0%': { 
            transform: 'translateX(-100px) translateY(-100px) rotate(-30deg)',
            opacity: '0'
          },
          '100%': { 
            transform: 'translateX(0) translateY(0) rotate(0deg)',
            opacity: '1'
          },
        },
        shine: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
}
