import PlayingIndicator from "@/src/components/PlayingIndicator";
import { TrackMoreModal } from "@/src/components/TrackMoreModal";
import { usePlayer } from "@/src/context/PlayerContext";
import { useTheme } from "@/src/context/ThemeContext";
import { getBaseURL } from "@/src/https";
import { Playlist } from "@/src/models";
import { downloadTracks } from "@/src/services/downloadManager";
import { Ionicons } from "@expo/vector-icons";
import { deletePlaylist, getPlaylistById, updatePlaylist } from "@soundx/services";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { playTrack, playTrackList, currentTrack, isPlaying } = usePlayer();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreModalVisible, setMoreModalVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [updating, setUpdating] = useState(false);
  const [trackMoreVisible, setTrackMoreVisible] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (id) {
      loadData(Number(id));
    }
  }, [id]);

  const loadData = async (playlistId: number) => {
    try {
      setLoading(true);
      const res = await getPlaylistById(Number(id));
      if (res.code === 200) setPlaylist(res.data);
    } catch (error) {
      console.error("Failed to load playlist details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!playlist || !newName.trim()) return;
    setUpdating(true);
    try {
      const res = await updatePlaylist(playlist.id, newName.trim());
      if (res.code === 200) {
        setPlaylist({ ...playlist, name: newName.trim() });
        setRenameModalVisible(false);
      }
    } catch (e) {
      console.error("Rename failed", e);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = () => {
    if (!playlist) return;
    setMoreModalVisible(false);
    Alert.alert("解散播放列表", `确定要解散“${playlist.name}”吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await deletePlaylist(playlist.id);
            if (res.code === 200) {
              router.back();
            }
          } catch (e) {
            console.error("Delete failed", e);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, justifyContent: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!playlist) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, justifyContent: "center" },
        ]}
      >
        <Text style={{ color: colors.text }}>Playlist not found</Text>
      </View>
    );
  }

  const tracks = playlist.tracks || [];

  // Extract unique albums for photo wall - use album name for uniqueness
  const uniqueAlbums = tracks
    .reduce((acc: any[], track) => {
      const albumKey = track.album || track.name;
      if (!acc.find((a) => (a.album || a.name) === albumKey)) {
        acc.push({
          cover: track.cover,
          id: track.id,
          album: track.album,
          name: track.name,
        });
      }
      return acc;
    }, [])
    .slice(0, 11); // Show max 11 album covers

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.customHeader,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitleText, { color: colors.text }]} numberOfLines={1}>
            {playlist.name}
          </Text>
          <Text style={[styles.headerSubtitleText, { color: colors.secondary }]}>
            {tracks.length} 首歌曲
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setMoreModalVisible(true)}
          style={styles.moreButton}
        >
          <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView>
        {/* Photo Wall - Staggered Grid */}
        <View style={styles.photoWall}>
          {uniqueAlbums.map((album, index) => {
            const isSmall = [0, 3, 7, 10].includes(index);
            const itemStyle = {
              width: isSmall ? "16.66%" : "33.33%",
              aspectRatio: isSmall ? 0.5 : 1,
            };

            return (
              <View key={index} style={[styles.photoWallItem, itemStyle as ViewStyle]}>
                <Image
                  source={{
                    uri: album.cover
                      ? album.cover.startsWith("http")
                        ? album.cover
                        : `${getBaseURL()}${album.cover}`
                      : `https://picsum.photos/seed/${album.id}/400/400`,
                  }}
                  style={styles.photoWallImage}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.trackList}>
          {tracks.map((track, index) => (
            <TouchableOpacity
              key={track.id}
              style={[styles.trackItem, { borderBottomColor: colors.border }]}
              onPress={() => {
                playTrackList(tracks, index);
              }}
              onLongPress={() => {
                setSelectedTrack(track);
                setTrackMoreVisible(true);
              }}
            >
              <View style={styles.trackIndexContainer}>
                {currentTrack?.id === track.id && isPlaying ? (
                  <PlayingIndicator />
                ) : (
                  <Text style={[styles.trackIndex, { color: currentTrack?.id === track.id ? colors.primary : colors.secondary }]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Image
                source={{
                  uri: track.cover
                    ? track.cover.startsWith("http")
                      ? track.cover
                      : `${getBaseURL()}${track.cover}`
                    : `https://picsum.photos/seed/${track.id}/20/20`,
                }}
                alt=""
                style={{ width: 40, height: 40, borderRadius: 4 }}
              />
              <View style={styles.trackInfo}>
                <Text
                  style={[styles.trackName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {track.name}
                </Text>
                <Text
                  style={[styles.trackArtist, { color: colors.secondary }]}
                  numberOfLines={1}
                >
                  {track.artist}
                </Text>
              </View>
              <Text style={[styles.trackDuration, { color: colors.secondary }]}>
                {track.duration
                  ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, "0")}`
                  : "--:--"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TrackMoreModal
        visible={trackMoreVisible}
        track={selectedTrack}
        onClose={() => setTrackMoreVisible(false)}
        onAddToPlaylist={(track) => {
          // Playlist detail already in a playlist, but user might want to add to another
          // Just ignore for now or implement AddToPlaylistModal here too
        }}
      />

      {/* More Actions Menu */}
      <Modal
        visible={moreModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMoreModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMoreModalVisible(false)}
        >
          <View style={[styles.menuContent, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMoreModalVisible(false);
                if (tracks.length === 0) return;
                Alert.alert("批量下载", `确定要下载播放列表“${playlist.name}”中的所有曲目吗？`, [
                  { text: "取消", style: "cancel" },
                  { text: "确定", onPress: () => {
                    downloadTracks(tracks, (completed: number, total: number) => {
                      if (completed === total) {
                        Alert.alert("下载完成", `播放列表“${playlist.name}”下载完成`);
                      }
                    });
                  }}
                ]);
              }}
            >
              <Ionicons name="cloud-download-outline" size={20} color={colors.text} />
              <Text style={[styles.menuText, { color: colors.text }]}>批量下载</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMoreModalVisible(false);
                setNewName(playlist.name);
                setRenameModalVisible(true);
              }}
            >
              <Ionicons name="create-outline" size={20} color={colors.text} />
              <Text style={[styles.menuText, { color: colors.text }]}>修改名称</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color="#ff4d4f" />
              <Text style={[styles.menuText, styles.dangerText]}>解散播放列表</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { marginTop: 10, justifyContent: 'center' }]}
              onPress={() => setMoreModalVisible(false)}
            >
              <Text style={[styles.menuText, { color: colors.secondary }]}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={renameModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>修改播放列表名称</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={{ color: colors.secondary }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleRename}
                disabled={updating || !newName.trim()}
              >
                {updating ? (
                  <ActivityIndicator size="small" color={theme === 'dark' ? '#000' : '#fff'} />
                ) : (
                  <Text style={[styles.confirmText, { color: theme === 'dark' ? '#000' : '#fff' }]}>
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
    alignItems: "center",
    padding: 20,
  },
  customHeader: {
    paddingHorizontal: 15,
    paddingBottom: 10,
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 10,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  headerSubtitleText: {
    fontSize: 12,
  },
  backButton: {
    padding: 5,
    width: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
  },
  photoWall: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    // gap: 4, // Commented out gap to rule out compatibility issues
  },
  photoWallItem: {
    width: "33.33%", // 3 items per row
    aspectRatio: 1,
    padding: 2, // Use padding to create spacing
  },
  photoWallImage: {
    width: "100%",
    height: "100%",
    borderRadius: 0,
    backgroundColor: "#ddd", // Placeholder color
  },
  trackList: {
    padding: 20,
  },
  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  trackIndex: {
    fontSize: 14,
    textAlign: 'center',
  },
  trackIndexContainer: {
    width: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
    marginHorizontal: 10,
  },
  trackName: {
    fontSize: 16,
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 12,
  },
  trackDuration: {
    fontSize: 12,
  },
  moreButton: {
    padding: 5,
    width: 40,
    alignItems: "flex-end",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    alignItems: 'center',
  },
  menuContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 450,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: "500",
  },
  dangerText: {
    color: "#ff4d4f",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    maxWidth: 450,
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    minWidth: 80,
    alignItems: "center",
  },
  confirmText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
