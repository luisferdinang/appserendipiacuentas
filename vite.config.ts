import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      'process.env': {
        ...Object.entries(env).reduce((prev, [key, val]) => ({
          ...prev,
          [key]: val
        }), {})
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      open: false
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      chunkSizeWarningLimit: 1600
    }
  };
});
