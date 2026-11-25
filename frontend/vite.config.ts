import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  envDir: path.resolve(__dirname, '..'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@remit-credit/client': path.resolve(__dirname, '../packages/remit-credit-client/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});