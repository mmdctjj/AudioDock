import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './AudioEq.types';

type AudioEqModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class AudioEqModule extends NativeModule<AudioEqModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(AudioEqModule, 'AudioEqModule');
