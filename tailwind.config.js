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
        // Backgrounds
        canvas:   '#060810',
        base:     '#0B1018',
        surface:  '#111822',
        raised:   '#172030',
        overlay:  '#1C2840',
        input:    '#0D1520',
        // Borders
        line:      '#202A36',
        lineMid:   '#2B3644',
        lineStrong: '#3A4759',
        // Text
        ink:       '#F5F7FA',
        inkSoft:   '#B5BFCA',
        inkMuted:  '#8E9BAB',
        inkDim:    '#5E6773',
        // Blue accent
        accent:         '#7EA6FF',
        accentPressed:  '#6B94F0',
        // Amber accent (workout/intensity)
        intensity:        '#FF8C3A',
        intensityPressed: '#E87C2E',
        // Semantic
        success: '#30D158',
        warning: '#FFD60A',
        danger:  '#FF453A',
        info:    '#64D2FF',
      },
      borderRadius: {
        xs:   '8px',
        sm:   '12px',
        card: '16px',
        lg:   '20px',
        xl:   '28px',
      },
      spacing: {
        18:  '72px',
        '4xl': '48px',
        '5xl': '64px',
      },
    },
  },
  plugins: [],
};
