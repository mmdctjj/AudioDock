import { NativeModule, requireNativeModule } from 'expo';

import { AudioEqModuleEvents } from './AudioEq.types';

declare class AudioEqModule extends NativeModule<AudioEqModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<AudioEqModule>('AudioEq');
