/**
 * TrackPlayer 原生扩展工具类
 * 目前均衡器逻辑已迁移至应用私有的 audio-eq 原生模块，此处暂时留空作为未来扩展点。
 */
export async function getAudioSessionId(): Promise<number> {
  // 不再建议通过此处获取，建议使用 AudioEq.discoverAndInit()
  return 0;
}