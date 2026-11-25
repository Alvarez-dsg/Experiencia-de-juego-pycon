// Catálogo de assets de IWSDK: el panel de rendimiento hecho en UIKitML (public/ui/rendimiento.uikitml).
// Los modelos del juego (animales, invasores, vegetación) se cargan en src/assets.js.
import { AssetType, defineAssets } from '@iwsdk/core';

const publicAssetUrl = (filePath) => `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

export default defineAssets({
  'panel-rendimiento': {
    url: publicAssetUrl('ui/rendimiento.uikitml'),
    type: AssetType.UIKitML,
    name: 'Panel de rendimiento',
  },
});
