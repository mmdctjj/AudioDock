import * as React from 'react';

import { AudioEqViewProps } from './AudioEq.types';

export default function AudioEqView(props: AudioEqViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
