import { requireNativeModule } from 'expo-modules-core';

// 引用原生模块
const AudioEq = requireNativeModule('AudioEq');

// 1. 初始化
// Android: 传入 AudioSessionId
// iOS: 传入 0 即可 (它会忽略)
export function initEqualizer(sessionId: number = 0) {
  return AudioEq.initEqualizer(sessionId);
}

// 自动发现并初始化
export function discoverAndInit() {
  return AudioEq.discoverAndInit();
}

// 2. 设置增益
// bandIndex: 0 - 4 (分别代表低音到高音)
// gainValue: -12 到 12 (dB)
export function setGain(bandIndex: number, gainValue: number) {
  return AudioEq.setGain(bandIndex, gainValue);
}

// 3. iOS 专用：因为 iOS EQ 需要接管播放
export function playUrl(url: string) {
  if (AudioEq.playUrl) {
    AudioEq.playUrl(url);
  }
}

// 4. Android 专用：获取频率列表
export function getBandFreqs() {
  if (AudioEq.getBandFreqs) {
    return AudioEq.getBandFreqs();
  }
  return [60, 230, 910, 3600, 14000]; // 默认值
}

// 5. 释放资源
export function release() {
  if (AudioEq.release) {
    AudioEq.release();
  }
}