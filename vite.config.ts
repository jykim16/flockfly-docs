import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/flockdoc/',
  plugins: [react()],
  server: {
    port: 3003,
    proxy: { '/v1': { target: process.env.FLOCKFLY_API_URL ?? 'http://127.0.0.1:8799', changeOrigin: true } },
  },
});
