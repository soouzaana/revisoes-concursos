/** @type {import('tailwindcss').Config} */
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), surface: c('surface'), sunken: c('sunken'), line: c('line'),
        ink: c('ink'), mute: c('mute'),
        accent: { DEFAULT: c('accent'), fg: c('accent-fg'), soft: c('accent-soft') },
        danger: { DEFAULT: c('danger'), soft: c('danger-soft') },
        warn: { DEFAULT: c('warn'), soft: c('warn-soft') },
        ok: { DEFAULT: c('ok'), soft: c('ok-soft') }
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"Figtree Variable"', 'system-ui', 'sans-serif']
      },
      keyframes: {
        rise: { '0%': { transform: 'translateY(12px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        pop: { '0%': { transform: 'scale(.96)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } }
      },
      animation: { rise: 'rise .22s ease-out', pop: 'pop .18s ease-out' }
    }
  },
  plugins: []
}
