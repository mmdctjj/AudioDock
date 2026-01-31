import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SOURCEMAP, SOURCETIPSMAP } from "@soundx/services";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function LoginFormScreen() {
  const { colors } = useTheme();
  const {
    login,
    register,
    switchServer,
    sourceType: authSourceType,
  } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  // Get source type from params, default to AudioDock
  const sourceType = (params.type as string) || "AudioDock";

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Two address inputs
  const [externalAddress, setExternalAddress] = useState("");
  const [internalAddress, setInternalAddress] = useState("");
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    loadSourceConfig(sourceType);
  }, [sourceType]);

  const loadSourceConfig = async (type: string) => {
    try {
      const configKey = `sourceConfig_${type}`;
      const savedConfig = await AsyncStorage.getItem(configKey);
      
      if (savedConfig) {
        const { internal, external } = JSON.parse(savedConfig);
        setInternalAddress(internal || "");
        setExternalAddress(external || "");

        // Try to restore credentials based on the last used address (or either)
        // We'll just pick external or internal to look up creds, usually they are same for the "Server Entity"
        // But our creds storage is by specific address.
        // Let's try to find creds for external first, then internal.
        if (external) await restoreCredentials(external, type);
        else if (internal) await restoreCredentials(internal, type);
      } else {
        // Defaults
        if (type === "AudioDock") {
           setInternalAddress("http://localhost:3000");
        } else {
           setInternalAddress("");
        }
        setExternalAddress("");
        setUsername("");
        setPassword("");
      }
    } catch (error) {
      console.error("Failed to load source config:", error);
    }
  };

  const restoreCredentials = async (address: string, type: string) => {
    try {
      const credsKey = `creds_${type}_${address}`;
      const savedCreds = await AsyncStorage.getItem(credsKey);
      if (savedCreds) {
        const { username: u, password: p } = JSON.parse(savedCreds);
        if (u) setUsername(u);
        if (p) setPassword(p);
      }
    } catch (e) {
      console.error("Failed to restore credentials", e);
    }
  };

  const handleSubmit = async () => {
    if (!externalAddress && !internalAddress) {
      Alert.alert("错误", "请至少输入一个数据源地址（内网或外网）");
      return;
    }
    if (!username || !password) {
      Alert.alert("错误", "请填写用户名和密码");
      return;
    }

    try {
      setLoading(true);

      // 1. Auto-select best server
      const bestAddress = await selectBestServer(internalAddress, externalAddress, sourceType);

      if (!bestAddress) {
        Alert.alert("连接失败", "无法连接到任一服务器地址，请检查网络或地址输入");
        setLoading(false);
        return;
      }

      console.log(`Selected Best Address: ${bestAddress}`);

      // 2. Save Config (Both addresses)
      const configKey = `sourceConfig_${sourceType}`;
      await AsyncStorage.setItem(configKey, JSON.stringify({
        internal: internalAddress,
        external: externalAddress
      }));

      // 3. Save Credentials (linked to the specific valid address we found, 
      // but maybe we should save for BOTH? For now, standard flow saves for the active one)
      const credsKey = `creds_${sourceType}_${bestAddress}`;
      await AsyncStorage.setItem(
        credsKey,
        JSON.stringify({ username, password }),
      );

      // 4. Switch Server
      await switchServer(bestAddress, sourceType, true);

      // 5. Login/Register
      const mappedType = SOURCEMAP[sourceType as keyof typeof SOURCEMAP] || "audiodock";
      if (isLogin) {
        await login({ username, password });
      } else {
        if (mappedType === "subsonic") {
          throw new Error("Subsonic 数据源不支持注册");
        }
        await register({ username, password });
      }
      
      router.replace("/(tabs)");

    } catch (error: any) {
      console.error(error);
      Alert.alert("错误", error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const LogoIcon = () => {
    if (sourceType === 'AudioDock') return <Image source={logo} style={styles.logo} />;
    if (sourceType === 'Subsonic') return <Image source={subsonicLogo} style={styles.logo} />;
    if (sourceType === 'Emby') return <Image source={embyLogo} style={styles.logo} />;
    return <Image source={logo} style={styles.logo} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
             <TouchableOpacity 
               onPress={() => {
                 router.replace("/login" as any);
               }} 
               style={styles.backButton}
             >
                <Text style={{color: colors.text, fontSize: 16, marginLeft: 5}}>切换类型</Text>
                <MaterialIcons name="grid-view" size={18} color={colors.text} />
             </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.logoContainer}>
               <LogoIcon />
               <Text style={[styles.title, { color: colors.text }]}>
                 {sourceType} {isLogin ? "登录" : "注册"}
               </Text>
            </View>
            
            <Text style={[styles.tips, { color: colors.secondary }]}>
                {SOURCETIPSMAP[sourceType as keyof typeof SOURCETIPSMAP]}
            </Text>

            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.text }]}>外网地址 (External)</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="http://music.example.com"
                placeholderTextColor={colors.secondary}
                value={externalAddress}
                onChangeText={setExternalAddress}
                autoCapitalize="none"
              />

              <Text style={[styles.label, { color: colors.text }]}>内网地址 (Internal)</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="http://192.168.1.10:3000"
                placeholderTextColor={colors.secondary}
                value={internalAddress}
                onChangeText={setInternalAddress}
                autoCapitalize="none"
              />

              <Text style={[styles.label, { color: colors.text }]}>用户名</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="用户名"
                placeholderTextColor={colors.secondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />

              <Text style={[styles.label, { color: colors.text }]}>密码</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="密码"
                placeholderTextColor={colors.secondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {!isLogin && (
                <>
                  <Text style={[styles.label, { color: colors.text }]}>确认密码</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                    placeholder="确认密码"
                    placeholderTextColor={colors.secondary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.background }]}>
                    {isLogin ? "登录" : "注册"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => setIsLogin(!isLogin)}
              >
                <Text style={[styles.switchText, { color: colors.secondary }]}>
                  {sourceType === "AudioDock"
                    ? isLogin
                      ? "没有账号？注册"
                      : "已有账号？登录"
                    : "AudioDock 听见你的声音"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 20,
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 0,
    justifyContent: "flex-start",
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 10,
    borderRadius: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  tips: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  form: {
    width: "100%",
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  input: {
    height: 45,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 8,
  },
  button: {
    height: 45,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  switchButton: {
    marginTop: 10,
    alignItems: "center",
  },
  switchText: {
    fontSize: 14,
  },
});
