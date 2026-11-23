import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev`      -> HTTPS en la red local (necesario para abrir WebXR desde las Meta Quest)
// `npm run dev:http` -> HTTP en localhost (para probar el modo escritorio o usar `adb reverse`)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'http' ? [] : [basicSsl()],
  server: { host: true, port: mode === 'http' ? 5174 : 5173 },
  preview: { host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
}));
