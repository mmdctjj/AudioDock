import { AddToPlaylistModal } from "@/src/components/AddToPlaylistModal";
import { AlbumMoreModal } from "@/src/components/AlbumMoreModal";
import PlayingIndicator from "@/src/components/PlayingIndicator";
import { TrackMoreModal } from "@/src/components/TrackMoreModal";
import { useAuth } from "@/src/context/AuthContext";
import { usePlayer } from "@/src/context/PlayerContext";
import { useTheme } from "@/src/context/ThemeContext";
import { getBaseURL } from "@/src/https";
import { Album, Track } from "@/src/models";
import { Ionicons } from "@expo/vector-icons";
import {
  getAlbumById,
  getAlbumTracks,
  toggleAlbumLike,
  unlikeAlbum,
} from "@soundx/services";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const { playTrack, playTrackList, currentTrack, isPlaying, seekTo } =
    usePlayer();
  const { user } = useAuth();
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [moreModalVisible, setMoreModalVisible] = useState(false);
  const [albumMoreVisible, setAlbumMoreVisible] = useState(false);
  const [addToPlaylistVisible, setAddToPlaylistVisible] = useState(false);

  const PAGE_SIZE = 50;

  useEffect(() => {
    if (id) {
      loadData(Number(id));
    }
  }, [id]);

  const loadData = async (albumId: number) => {
    try {
      setLoading(true);
      const [albumRes, tracksRes] = await Promise.all([
        getAlbumById(albumId),
        getAlbumTracks(albumId, PAGE_SIZE, 0),
      ]);

      if (albumRes.code === 200) {
        setAlbum(albumRes.data);
        const likedByUsers = albumRes.data.likedByUsers || [];
        const isLikedByCurrentUser = likedByUsers.some(
          (like: any) => like.userId === user?.id
        );
        setIsLiked(isLikedByCurrentUser);
      }
      if (tracksRes.code === 200) {
        setTracks(tracksRes.data.list);
        setTotal(tracksRes.data.total);
        setHasMore(tracksRes.data.list.length < tracksRes.data.total);
      }
    } catch (error) {
      console.error("Failed to load album details:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || !album) return;

    try {
      setLoadingMore(true);
      const res = await getAlbumTracks(album.id, PAGE_SIZE, tracks.length);
      if (res.code === 200) {
        const newList = [...tracks, ...res.data.list];
        setTracks(newList);
        setHasMore(newList.length < res.data.total);
      }
    } catch (error) {
      console.error("Failed to load more tracks:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleLike = async () => {
    if (!user || !album) return;
    try {
      const res = isLiked
        ? await unlikeAlbum(album.id, user.id)
        : await toggleAlbumLike(album.id, user.id);

      if (res.code === 200) {
        setIsLiked(!isLiked);
      }
    } catch (error) {
      console.error("Failed to toggle album like:", error);
    }
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

  if (!album) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, justifyContent: "center" },
        ]}
      >
        <Text style={{ color: colors.text }}>Album not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.customHeader, { backgroundColor: colors.background }]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setAlbumMoreVisible(true)}
          style={styles.moreButton}
        >
          <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <View style={styles.header}>
            <Image
              source={{
                uri: album.cover
                  ? `${getBaseURL()}${album.cover}`
                  : `https://picsum.photos/seed/${album.id}/300/300`,
              }}
              style={styles.cover}
            />
            <Text style={[styles.title, { color: colors.text }]}>
              {album.name}
            </Text>
            <Text style={[styles.artist, { color: colors.secondary }]}>
              {album.artist}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.playAllButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() => {
                  let startTrackIndex = 0;
                  let startTime = 0;

                  // Check if Audiobook and needs resume
                  if (album.type === "AUDIOBOOK") {
                    const resumeTrackId = (album as any).resumeTrackId;
                    const resumeProgress = (album as any).resumeProgress;

                    if (resumeTrackId) {
                      const foundIndex = tracks.findIndex(
                        (t) => t.id === resumeTrackId
                      );
                      if (foundIndex !== -1) {
                        startTrackIndex = foundIndex;
                        startTime = resumeProgress || 0;
                      }
                    }
                  }

                  playTrackList(tracks, startTrackIndex).then(() => {
                    if (startTime > 0) {
                      // Small delay to ensure track is loaded
                      setTimeout(() => seekTo(startTime), 500);
                    }
                  });
                }}
              >
                <Ionicons name="play" size={20} color={colors.background} />
                <Text
                  style={[styles.playAllText, { color: colors.background }]}
                >
                  播放全部
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.likeButton, { backgroundColor: colors.card }]}
                onPress={handleToggleLike}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={24}
                  color={isLiked ? colors.primary : colors.secondary}
                />
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.trackItem, { borderBottomColor: colors.border }]}
            onPress={() => {
              playTrackList(tracks, index);
              // If Audiobook and has progress, try to resume
               if (album.type === 'AUDIOBOOK' && ((item as any).progress > 0 || item.listenedAsAudiobookByUsers?.[0]?.progress)) {
                  const progress = (item as any).progress || item.listenedAsAudiobookByUsers?.[0]?.progress;
                  if (progress > 0) {
                      setTimeout(() => seekTo(progress), 500);
                  }
               }
            }}
            onLongPress={() => {
              setSelectedTrack(item);
              setMoreModalVisible(true);
            }}
          >
            <View style={styles.trackIndexContainer}>
              {currentTrack?.id === item.id && isPlaying ? (
                <PlayingIndicator />
              ) : (
                <Text
                  style={[
                    styles.trackIndex,
                    {
                      color:
                        currentTrack?.id === item.id
                          ? colors.primary
                          : colors.secondary,
                    },
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            <Image
              source={{
                uri: item.cover
                  ? `${getBaseURL()}${item.cover}`
                  : `https://picsum.photos/seed/${item.id}/20/20`,
              }}
              alt=""
              style={{ width: 20, height: 20, borderRadius: 2 }}
            />
            <View style={styles.trackInfo}>
              <Text
                style={[
                  styles.trackName,
                  {
                    color:
                      album.type === "AUDIOBOOK" &&
                      ((item as any).progress > 0 ||
                        item.listenedAsAudiobookByUsers?.[0]?.progress)
                        ? colors.secondary
                        : colors.text,
                  },
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </View>
            {album.type === "AUDIOBOOK" &&
            ((item as any).progress > 0 ||
              item.listenedAsAudiobookByUsers?.[0]?.progress) ? (
              <View style={{ marginRight: 10 }}>
                <Text style={{ fontSize: 10, color: colors.primary }}>
                  已听
                  {Math.floor(
                    (((item as any).progress ||
                      item.listenedAsAudiobookByUsers?.[0]?.progress ||
                      0) /
                      (item.duration || 1)) *
                      100
                  )}
                  %
                </Text>
              </View>
            ) : null}
            <Text style={[styles.trackDuration, { color: colors.secondary }]}>
              {item.duration
                ? `${Math.floor(item.duration / 60)}:${(item.duration % 60)
                    .toString()
                    .padStart(2, "0")}`
                : "--:--"}
            </Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 20 }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      />

      <TrackMoreModal
        visible={moreModalVisible}
        track={selectedTrack}
        onClose={() => setMoreModalVisible(false)}
        onAddToPlaylist={(track) => {
          setSelectedTrack(track);
          setAddToPlaylistVisible(true);
        }}
        onDeleteSuccess={(id) => {
          setTracks(tracks.filter((t) => t.id !== id));
        }}
      />

      <AddToPlaylistModal
        visible={addToPlaylistVisible}
        trackId={selectedTrack?.id ?? null}
        trackIds={selectedTrack ? undefined : tracks.map((t) => t.id)}
        onClose={() => {
          setAddToPlaylistVisible(false);
          setSelectedTrack(null);
        }}
      />

      <AlbumMoreModal
        visible={albumMoreVisible}
        album={album}
        trackIds={tracks.map((t) => t.id)}
        onClose={() => setAlbumMoreVisible(false)}
        onAddToPlaylist={() => {
          setAlbumMoreVisible(false);
          setSelectedTrack(null);
          setAddToPlaylistVisible(true);
        }}
      />
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
    paddingTop: 50, // Adjust for status bar
    paddingHorizontal: 15,
    paddingBottom: 10,
    zIndex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    padding: 5,
  },
  moreButton: {
    padding: 5,
  },
  cover: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  artist: {
    fontSize: 18,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  playAllButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
  },
  playAllText: {
    fontSize: 16,
    fontWeight: "600",
  },
  likeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 15,
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
    textAlign: "center",
  },
  trackIndexContainer: {
    width: 30,
    justifyContent: "center",
    alignItems: "center",
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
});
