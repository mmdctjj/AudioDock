import { requireNativeView } from 'expo';
import * as React from 'react';

import { AudioEqViewProps } from './AudioEq.types';

const NativeView: React.ComponentType<AudioEqViewProps> =
  requireNativeView('AudioEq');

export default function AudioEqView(props: AudioEqViewProps) {
  return <NativeView {...props} />;
}
