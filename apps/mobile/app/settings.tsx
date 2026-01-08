import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/context/AuthContext";
import { useSettings } from "../src/context/SettingsContext";
import { useTheme } from "../src/context/ThemeContext";
import { clearCache } from "../src/services/cache";
import { usePlayMode } from "../src/utils/playMode";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, theme, toggleTheme } = useTheme();
  const { mode, setMode } = usePlayMode();
  const { logout } = useAuth();
  const { acceptRelay, acceptSync, cacheEnabled, autoOrientation, autoTheme, updateSetting } = useSettings();

  const renderSettingRow = (
    label: string,
    description: string,
    value: boolean,
    onValueChange: (val: boolean) => void
  ) => (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.settingDescription, { color: colors.secondary }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#767577", true: colors.primary }}
        thumbColor={"#f4f3f4"}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>设置</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>通用</Text>
          
          {renderSettingRow(
            "跟随系统主题",
            "开启后将根据系统设置自动切换浅色/深色模式",
            autoTheme,
            (val) => updateSetting("autoTheme", val)
          )}

          <View style={{ opacity: autoTheme ? 0.5 : 1 }}>
            {renderSettingRow(
              "深色模式",
              "开启或关闭应用的深色外观",
              theme === "dark",
              autoTheme ? () => {} : toggleTheme
            )}
          </View>

          {renderSettingRow(
            "自动横竖屏",
            "开启后应用将跟随手机重力感应自动旋转",
            autoOrientation,
            (val) => updateSetting("autoOrientation", val)
          )}

          {renderSettingRow(
            "有声书模式",
            "切换音乐与有声书的显示内容",
            mode === "AUDIOBOOK",
            (val) => setMode(val ? "AUDIOBOOK" : "MUSIC")
          )}

          {renderSettingRow(
            "接力播放",
            "是否接受多设备之间播放接力",
            acceptRelay,
            (val) => updateSetting("acceptRelay", val)
          )}

          {renderSettingRow(
            "同步控制",
            "是否接受同数据源下其他用户的同步控制请求",
            acceptSync,
            (val) => updateSetting("acceptSync", val)
          )}

          {renderSettingRow(
            "边听边存",
            "播放时自动缓存到本地，下次播放优先使用本地文件",
            cacheEnabled,
            (val) => updateSetting("cacheEnabled", val)
          )}

          <TouchableOpacity 
            style={[styles.settingRow, { borderBottomColor: colors.border }]}
            onPress={() => {
              Alert.alert(
                "清除缓存",
                "确定要清除所有本地音频缓存吗？",
                [
                  { text: "取消", style: "cancel" },
                  { text: "确定", onPress: async () => {
                    await clearCache();
                    Alert.alert("已清除", "本地缓存已清空");
                  }}
                ]
              );
            }}
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>清除缓存</Text>
              <Text style={[styles.settingDescription, { color: colors.secondary }]}>
                释放本地存储空间
              </Text>
            </View>
            <Ionicons name="trash-outline" size={20} color={colors.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>账户</Text>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={() => {
              logout();
              router.replace("/login");
            }}
          >
            <Text style={styles.logoutText}>退出登录</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.versionText, { color: colors.secondary }]}>
            SoundX Mobile v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  backButton: {
    padding: 5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
    opacity: 0.6,
    textTransform: "uppercase",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingInfo: {
    flex: 1,
    marginRight: 20,
  },
  settingLabel: {
    fontSize: 17,
    fontWeight: "500",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  logoutButton: {
    marginTop: 20,
    backgroundColor: "#FF3B30",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  footer: {
    marginTop: 50,
    alignItems: "center",
  },
  versionText: {
    fontSize: 12,
  },
});
