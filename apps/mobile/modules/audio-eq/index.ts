// Reexport the native module. On web, it will be resolved to AudioEqModule.web.ts
// and on native platforms to AudioEqModule.ts
export { default } from './src/AudioEqModule';
export { default as AudioEqView } from './src/AudioEqView';
export * from  './src/AudioEq.types';
