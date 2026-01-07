import { useFocusEffect } from "@react-navigation/native";
import {
    createPlaylist,
    getAlbumHistory,
    getFavoriteAlbums,
    getFavoriteTracks,
    getPlaylists,
    getTrackHistory
} from "@soundx/services";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import { usePlayer } from "../../src/context/PlayerContext";
import { useTheme } from "../../src/context/ThemeContext";
import { getBaseURL } from "../../src/https";
import { Playlist, Track } from "../../src/models";
import { usePlayMode } from "../../src/utils/playMode";

import { Ionicons } from "@expo/vector-icons";

type TabType = "playlists" | "favorites" | "history";
type SubTabType = "track" | "album";

const StackedCover = ({ tracks }: { tracks: any[] }) => {
  const covers = (tracks || []).slice(0, 4);
  const { colors } = useTheme();
  return (
    <View style={styles.stackedCoverContainer}>
      {covers.map((track, index) => {
        let coverUrl = "https://picsum.photos/100";
        if (track.cover) {
          coverUrl = track.cover.startsWith("http") ? track.cover : `${getBaseURL()}${track.cover}`;
        }
        
        return (
          <Image
            key={track.id}
            source={{ uri: coverUrl }}
            style={[
              styles.itemCover,
              styles.stackedCover,
              { 
                zIndex: 4 - index,
                left: index * 6,
                top: index * 3,
                position: index === 0 ? 'relative' : 'absolute',
                opacity: 1 - (index * 0.1),
                borderColor: colors.card,
                borderWidth: index === 0 ? 0 : 1,
                transform: [
                  { scale: 1 - (index * 0.04) },
                ]
              }
            ]}
          />
        );
      })}
      {covers.length === 0 && (
        <Image
          source={{ uri: "https://picsum.photos/100" }}
          style={styles.itemCover}
        />
      )}
    </View>
  );
};

export default function PersonalScreen() {
  const { theme, toggleTheme, colors } = useTheme();
  const { mode, setMode } = usePlayMode();
  const { logout, user } = useAuth();
  const { playTrackList } = usePlayer();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>("playlists");
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>("track");
  const [loading, setLoading] = useState(false);
  
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadData();
      }
    }, [user, activeTab, activeSubTab, mode])
  );

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (activeTab === "playlists") {
        const res = await getPlaylists(mode as any, user.id); 
        if (res.code === 200) setPlaylists(res.data);
      } else if (activeTab === "favorites") {
        if (mode === "MUSIC" && activeSubTab === "track") {
          const res = await getFavoriteTracks(user.id, 0, 10000, mode as any);
          if (res.code === 200) setFavorites(res.data.list.map((item: any) => item.track));
        } else {
          const res = await getFavoriteAlbums(user.id, 0, 10000, mode as any);
          if (res.code === 200) setFavorites(res.data.list.map((item: any) => item.album));
        }
      } else if (activeTab === "history") {
        if (mode === "MUSIC" && activeSubTab === "track") {
          const res = await getTrackHistory(user.id, 0, 10000, mode as any);
          if (res.code === 200) setHistory(res.data.list.map((item: any) => item.track));
        } else {
          const res = await getAlbumHistory(user.id, 0, 10000, mode as any);
          if (res.code === 200) setHistory(res.data.list.map((item: any) => item.album));
        }
      }
    } catch (error) {
      console.error("Failed to load personal data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!user || !newPlaylistName.trim()) return;
    
    setCreating(true);
    try {
      const res = await createPlaylist(
        newPlaylistName.trim(),
        mode as any,
        user.id
      );
      
      if (res.code === 200) {
        setCreateModalVisible(false);
        setNewPlaylistName("");
        await loadData();
        router.push(`/playlist/${res.data.id}`);
      }
    } catch (error) {
      console.error("Failed to create playlist:", error);
    } finally {
      setCreating(false);
    }
  };

  const renderItem = React.useCallback(({ item }: { item: any }) => {
    const isPlaylist = activeTab === "playlists";
    const isAlbum = activeTab !== "playlists" && (mode === "AUDIOBOOK" || activeSubTab === "album");
    const data = item;
    let coverUrl = "https://picsum.photos/100";
    
    if (item.cover) {
      coverUrl = item.cover.startsWith("http") ? item.cover : `${getBaseURL()}${item.cover}`;
    }
    
    return (
      <TouchableOpacity 
        style={[styles.item, { borderBottomColor: colors.border }]}
        onPress={async () => {
          if (isPlaylist) {
            router.push(`/playlist/${(data as Playlist).id}`);
          } else if (isAlbum) {
            router.push(`/album/${data.id}`);
          } else {
            const list = activeTab === "favorites" ? favorites : history;
            const index = list.findIndex(t => t.id === (data as Track).id);
            playTrackList(list, index);
          }
        }}
      >
        {isPlaylist ? (
          <StackedCover tracks={(item as Playlist).tracks || []} />
        ) : (
          <View style={{ position: 'relative' }}>
            <Image
              source={{ uri: coverUrl }}
              style={styles.itemCover}
            />
            {/* Progress Bar for Audiobook Albums */}
            {isAlbum && activeTab === "history" && mode === "AUDIOBOOK" && (data as any).progress > 0 && (
                <View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 15, // marginRight of cover
                    height: 3,
                    backgroundColor: 'rgba(0,0,0,0.3)'
                }}>
                   <View style={{
                       width: `${(data as any).progress}%`,
                       height: '100%',
                       backgroundColor: colors.primary
                   }} />
                </View>
            )}
          </View>
        )}
        <View style={styles.itemInfo}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
            {data.name}
          </Text>
          <Text style={[styles.itemSubtitle, { color: colors.secondary }]}>
            {isPlaylist 
              ? `${(data as Playlist)._count?.tracks || (data as Playlist).tracks?.length || 0} 首` 
              : (isAlbum ? (data.artist || "") : (data as Track).artist)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [activeTab, activeSubTab, colors, favorites, history, playTrackList, mode]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCreateModalVisible(true)} style={styles.iconBtn}>
          <Ionicons name="add" size={28} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/settings")} style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* User Info */}
      <View style={styles.userInfo}>
        <Image
          source={{ uri: "https://picsum.photos/200" }} // Placeholder for avatar
          style={styles.avatar}
        />
        <Text style={[styles.nickname, { color: colors.text }]}>
          {user?.username || "未登录"}
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {[
          { key: "playlists", label: "播放列表" },
          { key: "favorites", label: "收藏" },
          { key: "history", label: "听过" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabItem,
              activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab(tab.key as TabType)}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab.key ? colors.primary : colors.secondary },
                activeTab === tab.key && { fontWeight: "bold" },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sub-tabs for MUSIC mode */}
      {mode === "MUSIC" && (activeTab === "favorites" || activeTab === "history") && (
        <View style={styles.subTabContainer}>
          {[
            { id: "album", label: "专辑" },
            { id: "track", label: "单曲" },
          ].map((sub) => (
            <TouchableOpacity
              key={sub.id}
              style={[
                styles.subTabItem,
                activeSubTab === sub.id && {
                  backgroundColor: "rgba(150,150,150,0.1)",
                },
              ]}
              onPress={() => setActiveSubTab(sub.id as SubTabType)}
            >
              <Text
                style={[
                  styles.subTabText,
                  {
                    color:
                      activeSubTab === sub.id
                        ? colors.primary
                        : colors.secondary,
                  },
                  activeSubTab === sub.id && { fontWeight: "bold" },
                ]}
              >
                {sub.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* List Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={activeTab === "playlists" ? playlists : (activeTab === "favorites" ? favorites : history)}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: colors.secondary, marginTop: 40 }}>暂无数据</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={createModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.createModalOverlay}>
          <View style={[styles.createModalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.createModalTitle, { color: colors.text }]}>新建播放列表</Text>
            <TextInput
              style={[
                styles.createInput,
                { 
                  color: colors.text, 
                  borderColor: colors.border,
                  backgroundColor: colors.background 
                }
              ]}
              placeholder="请输入列表名称"
              placeholderTextColor={colors.secondary}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />
            <View style={styles.createModalButtons}>
              <TouchableOpacity 
                style={styles.createCancelBtn} 
                onPress={() => {
                  setCreateModalVisible(false);
                  setNewPlaylistName("");
                }}
              >
                <Text style={{ color: colors.secondary }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.createConfirmBtn, { backgroundColor: colors.primary }]} 
                onPress={handleCreatePlaylist}
                disabled={creating || !newPlaylistName.trim()}
              >
                {creating ? (
                  <ActivityIndicator size="small" color={theme === 'dark' ? '#000' : '#fff'} />
                ) : (
                  <Text style={[styles.createConfirmText, { color: theme === 'dark' ? '#000' : '#fff' }]}>
                    确定
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    height: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  iconBtn: {
    padding: 5,
  },
  userInfo: {
    alignItems: "center",
    paddingVertical: 0,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 15,
  },
  nickname: {
    fontSize: 20,
    fontWeight: "bold",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 15,
  },
  tabText: {
    fontSize: 16,
  },
  subTabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  subTabItem: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  subTabText: {
    fontSize: 14,
  },
  item: {
    flexDirection: "row",
    padding: 15,
    alignItems: "center",
    borderBottomWidth: 0.5,
  },
  itemCover: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 15,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 13,
  },
  stackedCoverContainer: {
    width: 70,
    height: 60,
    marginRight: 15,
  },
  stackedCover: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    height: "60%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(150,150,150,0.2)",
  },
  settingText: {
    fontSize: 16,
  },
  logoutBtn: {
    marginTop: 40,
    backgroundColor: "#ff4d4f",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  createModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  createModalContent: {
    width: "80%",
    maxWidth: 450,
    borderRadius: 20,
    padding: 24,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  createModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  createInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  createModalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  createCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  createConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    justifyContent: "center",
    minWidth: 80,
    alignItems: "center",
  },
  createConfirmText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
