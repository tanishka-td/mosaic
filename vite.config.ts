import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // MapLibre is isolated in the async map engine chunk; its ~292 KB gzip payload
    // is reasonable even though its uncompressed module exceeds Vite's default.
    chunkSizeWarningLimit: 1100,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { test: /node_modules[\\/]maplibre-gl[\\/]/, name: 'map-engine' },
          ],
        },
      },
    },
  },
})
