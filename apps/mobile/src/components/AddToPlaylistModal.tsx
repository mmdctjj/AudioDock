import { Ionicons } from "@expo/vector-icons";
import { addTracksToPlaylist, addTrackToPlaylist, getPlaylists } from "@soundx/services";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Playlist, TrackType } from "../models";
import { usePlayMode } from "../utils/playMode";

interface AddToPlaylistModalProps {
  visible: boolean;
  trackId?: number | string | null;
  trackIds?: (number | string)[];
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  visible,
  trackId,
  trackIds,
  onClose,
  onSuccess,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { mode } = usePlayMode();
  const insets = useSafeAreaInsets();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | string | null>(null);

  useEffect(() => {
    if (visible && user) {
      loadPlaylists();
    }
  }, [visible, user, mode]);

  const loadPlaylists = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await getPlaylists(mode as TrackType, user.id);
      if (res.code === 200) {
        setPlaylists(res.data);
      }
    } catch (e) {
      console.error("Failed to load playlists", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: number | string) => {
    if (!trackId && (!trackIds || trackIds.length === 0)) return;
    try {
      setAddingId(playlistId);
      let res;
      if (trackIds && trackIds.length > 0) {
        res = await addTracksToPlaylist(playlistId, trackIds);
      } else if (trackId) {
        res = await addTrackToPlaylist(playlistId, trackId);
      }

      if (res && res.code === 200) {
        onSuccess?.();
        onClose();
      }
    } catch (e) {
      console.error("Failed to add track(s) to playlist", e);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.content,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 20, width: '100%', maxWidth: 450 },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>添加到播放列表</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.secondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ margin: 40 }} />
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.playlistItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleAddToPlaylist(item.id)}
                  disabled={addingId !== null}
                >
                  <Ionicons name="list" size={20} color={colors.primary} />
                  <Text style={[styles.playlistName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {addingId === item.id && (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={{ color: colors.secondary }}>暂无播放列表</Text>
                </View>
              }
              style={{ maxHeight: 400 }}
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: 'center',
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeBtn: {
    padding: 5,
  },
  playlistItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  playlistName: {
    fontSize: 16,
    flex: 1,
  },
  empty: {
    alignItems: "center",
    padding: 40,
  },
});
