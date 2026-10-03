import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { HeadphonesModuleEvents, HeadphonesStatus } from './Headphones.types';

declare class HeadphonesNativeModule extends NativeModule<HeadphonesModuleEvents> {
  isConnected(): boolean;
  getStatus(): HeadphonesStatus;
}

/**
 * `null` cuando el módulo nativo no está disponible (Expo Go, web o una build
 * antigua). En ese caso la app cae en el interruptor manual de ajustes.
 */
export default requireOptionalNativeModule<HeadphonesNativeModule>('Headphones');
