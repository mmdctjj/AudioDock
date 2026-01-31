import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SOURCEMAP, SOURCETIPSMAP } from "@soundx/services";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { selectBestServer } from "../src/utils/networkUtils";

const logo = require("../assets/images/logo.png");
const subsonicLogo = require("../assets/images/subsonic.png");
const embyLogo = require("../assets/images/emby.png");

export default function SourceManageScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { switchServer } = useAuth();

  const [configs, setConfigs] = useState<
    Record<string, { internal: string; external: string }>
  >({});
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadAllConfigs();
  }, []);

  const loadAllConfigs = async () => {
    const newConfigs: Record<string, { internal: string; external: string }> =
      {};
    for (const key of Object.keys(SOURCEMAP)) {
      try {
        const configKey = `sourceConfig_${key}`;
        const saved = await AsyncStorage.getItem(configKey);
        if (saved) {
          newConfigs[key] = JSON.parse(saved);
        } else {
          newConfigs[key] = {
            internal: key === "AudioDock" ? "http://localhost:3000" : "",
            external: "",
          };
        }
      } catch (e) {
        newConfigs[key] = { internal: "", external: "" };
      }
    }
    setConfigs(newConfigs);
  };

  const updateConfig = (
    key: string,
    field: "internal" | "external",
    value: string,
  ) => {
    setConfigs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const saveConfig = async (key: string) => {
    const config = configs[key];
    await AsyncStorage.setItem(`sourceConfig_${key}`, JSON.stringify(config));
  };

  const handleConnect = async (key: string) => {
    const config = configs[key];
    if (!config.internal && !config.external) {
      Alert.alert("提示", "请至少输入一个地址");
      return;
    }

    try {
      setLoadingType(key);
      await saveConfig(key); // Save first

      const bestAddress = await selectBestServer(
        config.internal,
        config.external,
        key,
      );

      if (!bestAddress) {
        setExpanded((prev) => ({ ...prev, [key]: true }));
        Alert.alert(
          "连接失败",
          "无法连接到该数据源的任一地址，请检查网络或配置",
        );
        return;
      }

      // Switch server
      // If the token is valid for this new address, switchServer will load it.
      // If not, app might redirect to login if wrapped in auth guard.
      await switchServer(bestAddress, key);

      router.back();
    } catch (error: any) {
      console.error(error);
      setExpanded((prev) => ({ ...prev, [key]: true }));
      Alert.alert("错误", error.message || "切换失败");
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          切换数据源
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.cardSubtitle, { color: colors.secondary }]}>
            Wi-Fi 环境下优先选择内网，移动网络环境下只选择外网
          </Text>
          {Object.keys(SOURCEMAP).map((key) => {
            const config = configs[key] || { internal: "", external: "" };
            const isLoading = loadingType === key;
            const isDisabled = key === "Emby";

            const getLogo = (key: string) => {
              switch (key) {
                case "Emby":
                  return embyLogo;
                case "Subsonic":
                  return subsonicLogo;
                default:
                  return logo;
              }
            };

            const hasValue = !!(config.internal || config.external);
            const isExpanded = expanded[key] ?? !hasValue; // Default to expanded if no value, collapsed if has value

            const toggleExpand = () => {
              setExpanded((prev) => ({
                ...prev,
                [key]: !isExpanded,
              }));
            };

            return (
              <View
                key={key}
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  isDisabled && { opacity: 0.5 },
                ]}
              >
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={hasValue ? toggleExpand : undefined}
                  activeOpacity={hasValue ? 0.7 : 1}
                >
                  <Image source={getLogo(key)} style={styles.cardLogo} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      {key}
                    </Text>
                    <Text
                      style={[styles.cardSubtitle, { color: colors.secondary }]}
                    >
                      {SOURCETIPSMAP[key as keyof typeof SOURCETIPSMAP]}
                    </Text>
                  </View>
                  {hasValue && (
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={24}
                      color={colors.secondary}
                    />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: colors.secondary }]}>
                        内网地址
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: colors.text,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                          },
                        ]}
                        value={config.internal}
                        onChangeText={(val) =>
                          updateConfig(key, "internal", val)
                        }
                        autoCapitalize="none"
                        placeholder="http://192.168.x.x:port"
                        placeholderTextColor={colors.secondary}
                        editable={!isDisabled}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: colors.secondary }]}>
                        外网地址
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: colors.text,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                          },
                        ]}
                        value={config.external}
                        onChangeText={(val) =>
                          updateConfig(key, "external", val)
                        }
                        autoCapitalize="none"
                        placeholder="https://example.com"
                        placeholderTextColor={colors.secondary}
                        editable={!isDisabled}
                      />
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={[
                    styles.connectButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => handleConnect(key)}
                  disabled={isDisabled || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <Text
                      style={[styles.buttonText, { color: colors.background }]}
                    >
                      {isExpanded ? "连接并切换" : "直接连接"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  backButton: {
    padding: 5,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 40,
    gap: 20,
  },
  card: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeader: {
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  cardLogo: {
    width: 40,
    height: 40,
    marginRight: 10,
    borderRadius: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 12,
  },
  inputGroup: {
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    marginBottom: 5,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  connectButton: {
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    fontWeight: "bold",
    fontSize: 16,
  },
});
