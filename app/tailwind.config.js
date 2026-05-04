/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'eris-bg': 'rgb(var(--eris-bg) / <alpha-value>)',
        'eris-surface': 'rgb(var(--eris-surface) / <alpha-value>)',
        'eris-surface-alt': 'rgb(var(--eris-surface-alt) / <alpha-value>)',
        'eris-text': 'rgb(var(--eris-text) / <alpha-value>)',
        'eris-text-muted': 'rgb(var(--eris-text-muted) / <alpha-value>)',
        'eris-text-subtle': 'rgb(var(--eris-text-subtle) / <alpha-value>)',
        'eris-border': 'rgb(var(--eris-border) / <alpha-value>)',
        'eris-primary': 'rgb(var(--eris-primary) / <alpha-value>)',
        'eris-danger': 'rgb(var(--eris-danger) / <alpha-value>)',
        'eris-success': 'rgb(var(--eris-success) / <alpha-value>)',
        'eris-position': 'rgb(var(--eris-position) / <alpha-value>)',
        'eris-alert': 'rgb(var(--eris-alert) / <alpha-value>)',
        'eris-weather-clear': 'rgb(var(--eris-weather-clear) / <alpha-value>)',
        'eris-weather-partly': 'rgb(var(--eris-weather-partly) / <alpha-value>)',
        'eris-weather-cloudy': 'rgb(var(--eris-weather-cloudy) / <alpha-value>)',
        'eris-weather-rainy': 'rgb(var(--eris-weather-rainy) / <alpha-value>)',
        'eris-weather-hail': 'rgb(var(--eris-weather-hail) / <alpha-value>)',
        'eris-weather-fog': 'rgb(var(--eris-weather-fog) / <alpha-value>)',
        'eris-weather-storm': 'rgb(var(--eris-weather-storm) / <alpha-value>)',
        'eris-weather-snow': 'rgb(var(--eris-weather-snow) / <alpha-value>)',
        'eris-weather-windy': 'rgb(var(--eris-weather-windy) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
