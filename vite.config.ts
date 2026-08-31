import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

function copy404Plugin() {
  let outDir = 'dist';
  return {
    name: 'copy-404',
    apply: 'build' as const,
    configResolved(config: { root: string; build: { outDir: string } }) {
      // build.outDir may be relative to the project root — resolve it once here
      // instead of hardcoding './dist', so a custom outDir stays correct.
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH || '/digital-archives-page/',
  plugins: [react(), copy404Plugin()],
  test: {
    environment: 'node',
    passWithNoTests: true,
  },
});
