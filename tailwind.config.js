/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#07090D',
        base: '#0D1117',
        surface: '#121821',
        raised: '#171F2A',
        overlay: '#1C2430',
        input: '#10161F',
        line: '#202A36',
        lineStrong: '#2B3644',
        ink: '#F5F7FA',
        inkSoft: '#B5BFCA',
        inkMuted: '#7D8896',
        accent: '#8EA8FF',
        accentPressed: '#7B96F4',
        success: '#47C97E',
        warning: '#E3A64D',
        danger: '#F06A6A',
        info: '#6CB6FF',
      },
      borderRadius: {
        card: '20px',
      },
      spacing: {
        18: '72px',
      },
    },
  },
  plugins: [],
};
