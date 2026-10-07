import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs, so the built site works from any folder on any static host.
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 700 },
});
