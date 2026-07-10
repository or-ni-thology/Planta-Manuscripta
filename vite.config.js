import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Tailwind is here (unlike Mooring, which is hand-styled) because the tree
// tool was built with Tailwind's utility classes for its layout — so we wire
// it into the build rather than rewrite all that layout by hand.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
