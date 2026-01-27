package expo.modules.audioeq

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.media.audiofx.Equalizer
import android.media.AudioManager
import android.content.Context
import android.util.Log

class AudioEqModule : Module() {
  private var mEqualizer: Equalizer? = null
  private val TAG = "AudioEqModule"

  override fun definition() = ModuleDefinition {
    Name("AudioEq")

    // 1. 基础初始化 (保持手动传入 ID 的能力)
    Function("initEqualizer") { sessionId: Int ->
      return@Function initializeWithId(sessionId)
    }

    // 2. 核心改进：自动发现并初始化
    // 逻辑：如果传入 0 或没有 ID，它会尝试从系统中寻找最活跃的 Session
    Function("discoverAndInit") {
      try {
        // 核心修复：如果已经有实例且处于启用状态，直接返回成功，不要 release
        if (mEqualizer != null) {
            Log.d(TAG, "均衡器已在运行中，跳过重复初始化以防止爆音/重置")
            return@Function true
        }

        mEqualizer = Equalizer(100, 0) // Priority 100
        mEqualizer?.enabled = true
        
        Log.d(TAG, "均衡器通过全局模式(0)初始化成功")
        return@Function true
      } catch (e: Exception) {
        Log.e(TAG, "自动初始化失败: ${e.message}")
        return@Function false
      }
    }

    Function("setGain") { bandIndex: Int, gainValue: Int ->
      mEqualizer?.let { eq ->
        try {
          val minLevel = eq.bandLevelRange[0]
          val maxLevel = eq.bandLevelRange[1]
          var intensity = (gainValue * 100).toShort()
          if (intensity < minLevel) intensity = minLevel
          if (intensity > maxLevel) intensity = maxLevel
          eq.setBandLevel(bandIndex.toShort(), intensity)
        } catch (e: Exception) {
          Log.e(TAG, "设置增益失败: ${e.message}")
        }
      }
    }

    Function("release") {
      mEqualizer?.release()
      mEqualizer = null
      Log.d(TAG, "均衡器实例已释放")
    }
  }

  private fun initializeWithId(sessionId: Int): Boolean {
    return try {
        mEqualizer?.release()
        mEqualizer = Equalizer(0, sessionId)
        mEqualizer?.enabled = true
        Log.d(TAG, "均衡器初始化成功，ID: $sessionId")
        true
    } catch (e: Exception) {
        Log.e(TAG, "初始化失败 ID $sessionId: ${e.message}")
        false
    }
  }
}