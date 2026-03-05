import { defineConfig } from 'vite';

// A Vite config to build the index.html demo application instead of the library
export default defineConfig({
    build: {
        outDir: 'dist-demo',
        emptyOutDir: true
    }
});
