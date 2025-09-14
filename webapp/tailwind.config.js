/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'chat-bg': '#0f0f0f',
        'chat-input': '#2f2f2f',
        'chat-border': '#565869',
        'chat-text': '#ffffff',
        'chat-placeholder': '#8e8ea0',
        'chat-primary': '#10a37f',
        'chat-primary-hover': '#0d8a6b',
      },
    },
  },
  plugins: [],
}
