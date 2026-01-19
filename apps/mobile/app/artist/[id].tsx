import { AddToPlaylistModal } from "@/src/components/AddToPlaylistModal";
import PlayingIndicator from "@/src/components/PlayingIndicator";
import { TrackMoreModal } from "@/src/components/TrackMoreModal";
import { usePlayer } from "@/src/context/PlayerContext";
import { useTheme } from "@/src/context/ThemeContext";
import { getBaseURL } from "@/src/https";
import { Album, Artist, Track, TrackType } from "@/src/models";
import { usePlayMode } from "@/src/utils/playMode";
import { Ionicons } from "@expo/vector-icons";
import {
  getAlbumsByArtist,
  getArtistById,
  getCollaborativeAlbumsByArtist,
  getTracksByArtist,
} from "@soundx/services";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { playTrackList, currentTrack, isPlaying } = usePlayer();
  const { mode } = usePlayMode();
  const router = useRouter();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [collaborativeAlbums, setCollaborativeAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [moreModalVisible, setMoreModalVisible] = useState(false);
  const [addToPlaylistVisible, setAddToPlaylistVisible] = useState(false);

  useEffect(() => {
    if (id) {
      loadData(Number(id));
    }
  }, [id]);

  const loadData = async (artistId: number) => {
    try {
      setLoading(true);
      const [artistRes] = await Promise.all([getArtistById(artistId)]);

      if (artistRes.code === 200) {
        setArtist(artistRes.data);
        // Fetch albums and tracks using the artist name
        if (artistRes.data.name) {
          const [albumsRes, collaborativeRes, tracksRes] = await Promise.all([
            getAlbumsByArtist(artistRes.data.name),
            getCollaborativeAlbumsByArtist(artistRes.data.name),
            getTracksByArtist(artistRes.data.name),
          ]);
          if (albumsRes.code === 200) setAlbums(albumsRes.data);
          if (collaborativeRes.code === 200)
            setCollaborativeAlbums(collaborativeRes.data);
          if (tracksRes.code === 200) setTracks(tracksRes.data);
        }
      }
    } catch (error) {
      console.error("Failed to load artist details:", error);
    } finally {
      setLoading(false);
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

  if (!artist) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, justifyContent: "center" },
        ]}
      >
        <Text style={{ color: colors.text }}>Artist not found</Text>
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
      </View>
      <ScrollView>
        <View style={styles.header}>
          <Image
            source={{
              uri: artist.avatar
                ? `${getBaseURL()}${artist.avatar}`
                : `https://picsum.photos/seed/${artist.id}/300/300`,
            }}
            style={styles.avatar}
          />
          <Text style={[styles.name, { color: colors.text }]}>
            {artist.name}
          </Text>
        </View>

        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text, paddingHorizontal: 20 },
            ]}
          >
            所有专辑 ({albums.length})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ paddingHorizontal: 20, paddingBottom: 20 }}
          >
            {albums.map((album) => (
              <TouchableOpacity
                key={album.id}
                style={styles.albumCard}
                onPress={() => router.push(`/album/${album.id}`)}
              >
                <View style={styles.albumCoverContainer}>
                  <Image
                    source={{
                      uri: album.cover
                        ? `${getBaseURL()}${album.cover}`
                        : `https://picsum.photos/seed/${album.id}/200/200`,
                    }}
                    style={styles.albumCover}
                  />
                  {(album.type === "AUDIOBOOK") &&
                    (album as any).progress > 0 && (
                      <View style={styles.progressOverlay}>
                        <View
                          style={[
                            styles.progressBar,
                            {
                              width: `${album.progress || 0}%`,
                              backgroundColor: colors.primary,
                            },
                          ]}
                        />
                      </View>
                    )}
                </View>
                <Text
                  style={[styles.albumName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {album.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {collaborativeAlbums.length > 0 && (
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.text, paddingHorizontal: 20 },
              ]}
            >
              合作专辑 ({collaborativeAlbums.length})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ paddingHorizontal: 20, paddingBottom: 20 }}
            >
              {collaborativeAlbums.map((album) => (
                <TouchableOpacity
                  key={album.id}
                  style={styles.albumCard}
                  onPress={() => router.push(`/album/${album.id}`)}
                >
                  <View style={styles.albumCoverContainer}>
                    <Image
                      source={{
                        uri: album.cover
                          ? `${getBaseURL()}${album.cover}`
                          : `https://picsum.photos/seed/${album.id}/200/200`,
                      }}
                      style={styles.albumCover}
                    />
                    {(album.type === "AUDIOBOOK" ||
                      artist.type === "AUDIOBOOK") &&
                      (album as any).progress > 0 && (
                        <View style={styles.progressOverlay}>
                          <View
                            style={[
                              styles.progressBar,
                              {
                                width: `${album.progress || 0}%`,
                                backgroundColor: colors.primary,
                              },
                            ]}
                          />
                        </View>
                      )}
                  </View>
                  <Text
                    style={[styles.albumName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {album.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {mode !== TrackType.AUDIOBOOK && (
          <View style={[styles.section, styles.trackList]}>
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.text, marginBottom: 0 },
                ]}
              >
                所有单曲 ({tracks.length})
              </Text>
              <TouchableOpacity
                onPress={() => tracks.length > 0 && playTrackList(tracks, 0)}
                style={[styles.playButton, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="play" size={20} color={colors.background} />
              </TouchableOpacity>
            </View>
            {tracks.map((track, index) => (
              <TouchableOpacity
                key={track.id}
                style={[styles.trackItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  playTrackList(tracks, index);
                }}
                onLongPress={() => {
                  setSelectedTrack(track);
                  setMoreModalVisible(true);
                }}
              >
                <View style={styles.trackIndexContainer}>
                  {currentTrack?.id === track.id && isPlaying ? (
                    <PlayingIndicator />
                  ) : (
                    <Text
                      style={[
                        styles.trackIndex,
                        {
                          color:
                            currentTrack?.id === track.id
                              ? colors.primary
                              : colors.secondary,
                        },
                      ]}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>
                <View style={styles.trackInfo}>
                  <Image
                    source={{
                      uri: track.cover
                        ? `${getBaseURL()}${track.cover}`
                        : `https://picsum.photos/seed/${track.id}/20/20`,
                    }}
                    alt=""
                    style={{ width: 20, height: 20 }}
                  />
                  <Text
                    style={[styles.trackName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {track.name}
                  </Text>
                </View>
                <Text
                  style={[styles.trackDuration, { color: colors.secondary }]}
                >
                  {track.duration
                    ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, "0")}`
                    : "--:--"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

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
        onClose={() => setAddToPlaylistVisible(false)}
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
  },
  backButton: {
    padding: 5,
  },
  avatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 15,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  section: {
    padding: 0,
  },
  trackList: {
    marginBottom: 60,
    paddingBottom: 70,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  albumCard: {
    marginRight: 15,
    width: 120,
  },
  albumCoverContainer: {
    width: 120,
    height: 120,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    marginBottom: 5,
  },
  albumCover: {
    width: 120,
    height: 120,
  },
  progressOverlay: {
    position: "absolute",
    bottom: 5,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  progressBar: {
    height: "100%",
  },
  albumName: {
    fontSize: 14,
    textAlign: "center",
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
    width: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  trackInfo: {
    flex: 1,
    display: "flex",
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
  },
  trackName: {
    fontSize: 16,
  },
  trackDuration: {
    fontSize: 12,
  },
});
