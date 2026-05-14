/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand — sky blue (from WhoCares logo's hand)
        brand: {
          50:  '#E5F2FB',
          100: '#CFE5F5',
          200: '#A5CFEC',
          300: '#7AB6DF',
          400: '#4FA0D3',
          500: '#2E8DC9',
          600: '#1B6DA0',
          700: '#155682',
          800: '#0F4063',
          900: '#0A2D45',
        },
        // Accent — nature green (from WhoCares logo's leaf)
        accent: {
          50:  '#EDF7E8',
          100: '#D9EFD0',
          200: '#B6E0A4',
          300: '#90CE76',
          400: '#74BB59',
          500: '#5DA945',
          600: '#3F7F2E',
          700: '#306121',
          800: '#234717',
          900: '#16300E',
        },
        // Surfaces — blue-tinted neutrals
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F8FAFC',     // page background (faint blue-gray)
          alt: '#EFF4F8',         // soft blue-tinted surface for headers / hover
        },
        // Text — deep blue-gray scale (NOT pure black)
        ink: {
          900: '#1A2B3A',
          700: '#4A6580',
          500: '#8FA3B8',
          300: '#B5C2CF',
        },
        // Semantic
        positive: { DEFAULT: '#5DA945', soft: '#EDF7E8' },
        warning:  { DEFAULT: '#E8A23B', soft: '#FEF3D9' },
        danger:   { DEFAULT: '#D9534F', soft: '#FDECEA' },
        // Borders
        outline: { DEFAULT: '#E1E8EF', strong: '#C7D2DD' },
      },
      borderRadius: {
        // Mobile uses 22 for hero / big cards — pulling that exact value over
        xl: '16px',
        '2xl': '22px',
      },
      boxShadow: {
        // Mobile uses #2E8DC9-tinted shadows for warmth
        'brand-low':  '0 2px 4px 0 rgba(46, 141, 201, 0.06)',
        'brand-md':   '0 4px 8px -1px rgba(46, 141, 201, 0.08), 0 2px 4px -1px rgba(46, 141, 201, 0.04)',
        'brand-high': '0 4px 12px 0 rgba(46, 141, 201, 0.12)',
      },
      fontFamily: {
        // CSS variable injected by next/font in app/layout.tsx
        sans: ['var(--font-noto-sans-tc)', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in':   'fade-in 150ms ease-out',
        'scale-in':  'scale-in 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
