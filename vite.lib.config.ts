import path from 'path';
import { defineConfig } from 'vite';

// Library build: `bun run build:lib` → dist-lib/ (types via tsconfig.lib.json).
// The demo app keeps using vite.config.ts → dist/.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    target: 'es2022',
    lib: {
      entry: {
        index: path.resolve(import.meta.dirname, 'src/lib/index.ts'),
        core: path.resolve(import.meta.dirname, 'src/lib/core.ts'),
        react: path.resolve(import.meta.dirname, 'src/lib/react.tsx'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
});
