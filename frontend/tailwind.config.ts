import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // iOS light system colors
        ios: {
          bg:        '#EAEAEF',   // soft muted background
          surface:   '#F5F4F8',   // off-white surface (not pure white)
          elevated:  '#EEEDF3',
          fill:      '#DDDDE3',
          separator: 'rgba(30,30,50,0.1)',
          blue:      '#007AFF',
          purple:    '#5E5CE6',
          teal:      '#32ADE6',
          green:     '#34C759',
          red:       '#FF3B30',
          label:     '#18181B',   // near-black, easier on eyes
          label2:    'rgba(30,30,50,0.55)',
          label3:    'rgba(30,30,50,0.38)',
          label4:    'rgba(30,30,50,0.16)',
        },
      },
      boxShadow: {
        'ios-sm': '0 1px 8px rgba(0,0,0,0.08)',
        'ios':    '0 2px 20px rgba(0,0,0,0.1)',
        'ios-lg': '0 8px 40px rgba(0,0,0,0.14)',
        'blue-glow': '0 4px 16px rgba(0,122,255,0.28)',
      },
    },
  },
  plugins: [],
}

export default config
