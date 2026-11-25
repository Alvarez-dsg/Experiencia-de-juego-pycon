import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig } from 'vite';

// Proyecto creado con el instalador oficial de IWSDK (npm create @iwsdk@latest, modo RA).
// `npm run dev`      -> HTTPS en la red local (necesario para abrir WebXR desde las Meta Quest) + emulador IWER en localhost
// `npm run dev:http` -> HTTP en localhost (para probar el modo escritorio)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [iwsdkDev({ https: mode !== 'http' })],
  server: { host: '0.0.0.0', port: mode === 'http' ? 5174 : 5173, open: false },
  preview: { host: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext',
    chunkSizeWarningLimit: 2500,
    rollupOptions: { input: './index.html' },
  },
  esbuild: { target: 'esnext' },
  // @drawcall/uikitml podría traer una segunda copia de three/@pmndrs/uikit (ver plantilla de IWSDK)
  resolve: { dedupe: ['three', '@pmndrs/uikit', '@pmndrs/uikit-horizon', '@pmndrs/uikit-lucide'] },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
    include: ['three', '@pmndrs/uikit', '@pmndrs/uikit-horizon', '@pmndrs/uikit-lucide', '@drawcall/uikitml'],
    esbuildOptions: { target: 'esnext' },
  },
  publicDir: 'public',
}));
