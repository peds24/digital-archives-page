import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const distIndex = fileURLToPath(new URL('./dist/index.html', import.meta.url));
const dist404 = fileURLToPath(new URL('./dist/404.html', import.meta.url));

export default defineConfig({
  base: process.env.BASE_PATH || '/digital-archives-page/',
  plugins: [
    react(),
    {
      name: 'copy-404',
      closeBundle() {
        copyFileSync(distIndex, dist404);
      },
    },
  ],
  test: {
    environment: 'node',
    passWithNoTests: true,
  },
});
