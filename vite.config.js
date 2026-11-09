import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // the AI worker (src/lib/aiWorker.js) loads onnxruntime-web as a module
  worker: { format: 'es' },
})