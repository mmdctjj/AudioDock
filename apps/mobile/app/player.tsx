import MarqueeText from "@/src/components/MarqueeText";
import PlayingIndicator from "@/src/components/PlayingIndicator";
import { useAuth } from "@/src/context/AuthContext";
import { PlayMode, usePlayer } from "@/src/context/PlayerContext";
import { useTheme } from "@/src/context/ThemeContext";
import { getBaseURL } from "@/src/https";
import { Track, TrackType, UserTrackLike } from "@/src/models";
import { Ionicons } from "@expo/vector-icons";
import { Slider } from "@miblanchard/react-native-slider";
import { toggleLike, toggleUnLike } from "@soundx/services";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlayerMoreModal } from "../src/components/PlayerMoreModal";
import { PlaylistModal } from "../src/components/PlaylistModal";
import SyncModal from "../src/components/SyncModal";

const { width } = Dimensions.get("window");

// Parse LRC format lyrics
interface LyricLine {
  time: number;
  text: string;
}

const parseLyrics = (lyrics: string): LyricLine[] => {
  if (!lyrics) return [];

  const lines = lyrics.split("\n");
  const parsed: LyricLine[] = [];

  for (const line of lines) {
    // Match LRC format: [mm:ss.xx], [mm:ss], [hh:mm:ss]
    // Group 1: Part 1 (mm or hh)
    // Group 2: Part 2 (ss or mm)
    // Group 3: Separator (. or :)
    // Group 4: Part 3 (xx or ss)
    // Group 5: Text
    const match = line.match(/\[(\d+):(\d+)(?:([\.:])(\d+))?\](.*)/);
    if (match) {
      const part1 = parseInt(match[1]);
      const part2 = parseInt(match[2]);
      const separator = match[3];
      const part3Str = match[4];
      const text = match[5].trim();

      let time = 0;
      // If separator is ':' and we have 3 parts, assume hh:mm:ss
      if (separator === ":" && part3Str) {
        const hours = part1;
        const minutes = part2;
        const seconds = parseInt(part3Str);
        time = hours * 3600 + minutes * 60 + seconds;
      } else {
        // Assume mm:ss.xx or mm:ss
        const minutes = part1;
        const seconds = part2;
        const milliseconds = part3Str ? parseInt(part3Str.padEnd(3, "0")) : 0;
        time = minutes * 60 + seconds + milliseconds / 1000;
      }

      if (text) {
        parsed.push({ time, text });
      }
    } else if (line.trim() && !line.startsWith("[")) {
      // Plain text without timestamp
      parsed.push({ time: 0, text: line.trim() });
    }
  }
  return parsed.sort((a, b) => a.time - b.time);
};

export default function PlayerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const {
    currentTrack,
    isPlaying,
    pause,
    resume,
    duration,
    position,
    seekTo,
    trackList,
    playTrackList,
    playMode,
    playNext,
    playPrevious,
    togglePlayMode,
    isSynced,
    handleDisconnect,
    setShowPlaylist,
    isLoading,
    playbackRate,
    setPlaybackRate,
  } = usePlayer();
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [moreModalVisible, setMoreModalVisible] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [liked, setLiked] = useState(false);
  const { user } = useAuth();

  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<any>(null);
  const [artworkHeight, setArtworkHeight] = useState(0);
  const [controlsHeight, setControlsHeight] = useState(0);
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  const resetHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    if (!needsAutoHide) {
      setControlsVisible(true);
      return;
    }

    setControlsVisible(true);
    hideTimerRef.current = setTimeout(() => {
      if (isLandscape && needsAutoHide) {
        setControlsVisible(false);
      }
    }, 3000); // 3 seconds of inactivity as per previous requirements
  };

  const needsAutoHide =
    isLandscape &&
    artworkHeight > 0 &&
    controlsHeight > 0 &&
    artworkHeight + controlsHeight + 80 > height; // 80 is estimated padding/gaps for landscape safe area and spacing

  useEffect(() => {
    if (isLandscape && needsAutoHide && controlsVisible) {
      resetHideTimer();
    } else if (!isLandscape || !needsAutoHide) {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isLandscape, needsAutoHide, controlsVisible]);

  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: controlsVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [controlsVisible]);

  useEffect(() => {
    if (currentTrack && user) {
      const trackData = currentTrack as unknown as Track;
      const isLiked = trackData.likedByUsers?.some(
        (like: UserTrackLike) => like.userId === user.id
      );
      setLiked(!!isLiked);
    }
  }, [currentTrack, user]);

  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      breatheAnim.stopAnimation();
      breatheAnim.setValue(1);
    }
  }, [isLoading]);

  const handleToggleLike = async () => {
    if (!currentTrack || !user) return;
    const previousLiked = liked;
    setLiked(!liked);

    try {
      if (previousLiked) {
        await toggleUnLike(Number(currentTrack.id), user.id);
      } else {
        await toggleLike(Number(currentTrack.id), user.id);
      }
    } catch (error) {
      console.error("Failed to toggle like", error);
      setLiked(previousLiked);
    }
  };

  useEffect(() => {
    const shouldShowLyrics = isLandscape
      ? currentTrack?.type !== TrackType.AUDIOBOOK
      : showLyrics;

    if (!shouldShowLyrics || !currentTrack?.lyrics) return;

    const lyrics = parseLyrics(currentTrack.lyrics);
    const activeIndex = lyrics.findIndex((line, index) => {
      return (
        line.time <= position &&
        (index === lyrics.length - 1 || lyrics[index + 1].time > position)
      );
    });

    if (activeIndex !== -1 && activeIndex !== currentLyricIndex) {
      setCurrentLyricIndex(activeIndex);
      const lineHeight = 40;
      const containerHeight = isLandscape ? height * 0.8 : width * 0.7;
      const scrollToY =
        activeIndex * lineHeight - containerHeight / 2 + lineHeight / 2;

      scrollViewRef.current?.scrollTo({
        y: Math.max(0, scrollToY),
        animated: true,
      });
    }
  }, [
    position,
    showLyrics,
    isLandscape,
    currentTrack?.lyrics,
    currentTrack?.type,
    currentLyricIndex,
    width,
    height,
  ]);

  const formatTime = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const togglePlayback = () => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const getModeIconName = (mode: PlayMode): any => {
    switch (mode) {
      case PlayMode.SEQUENCE:
        return "arrow-forward";
      case PlayMode.LOOP_LIST:
        return "repeat";
      case PlayMode.SHUFFLE:
        return "shuffle";
      case PlayMode.LOOP_SINGLE:
        return "sync";
      case PlayMode.SINGLE_ONCE:
        return "stop-circle-outline";
      default:
        return "repeat";
    }
  };

  const togglePlaybackRate = () => {
    const rates = [0.5, 1, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
  };

  const skipForward = () => seekTo(position + 15);
  const skipBackward = () => seekTo(Math.max(0, position - 15));

  if (!currentTrack) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>No track playing</Text>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
        >
          <Text style={{ color: colors.primary, marginTop: 20 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderPlaylist = () => (
    <FlatList
      data={trackList}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item, index }) => (
        <TouchableOpacity
          style={[
            styles.playlistItem,
            currentTrack?.id === item.id && styles.activePlaylistItem,
          ]}
          onPress={() => playTrackList(trackList, index)}
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
                ? typeof item.cover === "string" &&
                  item.cover.startsWith("http")
                  ? item.cover
                  : `${getBaseURL()}${item.cover}`
                : `https://picsum.photos/seed/${item.id}/20/20`,
            }}
            style={styles.playlistItemCover}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text
              style={[
                styles.playlistItemText,
                {
                  color:
                    currentTrack?.id === item.id ? colors.primary : colors.text,
                },
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {currentTrack?.type === TrackType.AUDIOBOOK &&
              (item as any).progress > 0 && (
                <Text
                  style={{
                    fontSize: 10,
                    color: colors.secondary,
                    marginTop: 2,
                  }}
                >
                  已听{" "}
                  {Math.floor(
                    (((item as any).progress || 0) / (item.duration || 1)) * 100
                  )}
                  %
                </Text>
              )}
          </View>
        </TouchableOpacity>
      )}
      style={styles.playlist}
    />
  );

  const renderControls = () => (
    <View>
      <View style={styles.infoContainer}>
        <View style={styles.textContainer}>
          <MarqueeText
            text={currentTrack.name}
            style={[styles.trackTitle, { color: colors.text }]}
          />
          <Text style={[styles.trackArtist, { color: colors.secondary }]}>
            {currentTrack.artist}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            if (isSynced) {
              handleDisconnect();
            } else {
              setSyncModalVisible(true);
            }
            resetHideTimer();
          }}
          style={[styles.syncButton, isSynced && styles.syncButtonActive]}
        >
          <Ionicons
            name={isSynced ? "people" : "people-outline"}
            size={24}
            color={isSynced ? colors.primary : colors.text}
          />
        </TouchableOpacity>

        <SyncModal
          visible={syncModalVisible}
          onClose={() => setSyncModalVisible(false)}
        />
        <PlayerMoreModal
          visible={moreModalVisible}
          setVisible={setMoreModalVisible}
          onClose={() => setMoreModalVisible(false)}
          currentTrack={currentTrack}
          router={router}
        />
        <PlaylistModal />
        {currentTrack.type !== TrackType.AUDIOBOOK && (
          <TouchableOpacity
            onPress={() => {
              handleToggleLike();
              resetHideTimer();
            }}
            style={styles.likeButton}
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={24}
              color={liked ? colors.primary : colors.text}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => {
            setMoreModalVisible(true);
            resetHideTimer();
          }}
          style={styles.likeButton}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, { color: colors.secondary }]}>
          {formatTime(position)}
        </Text>
        <Slider
          containerStyle={{ flex: 1, height: 40, marginHorizontal: 10 }}
          minimumValue={0}
          maximumValue={duration}
          value={position}
          onSlidingComplete={(value) => {
            seekTo(Array.isArray(value) ? value[0] : value);
            resetHideTimer();
          }}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
          renderThumbComponent={() => (
            <Animated.View
              style={{
                width: 15,
                height: 15,
                borderRadius: 8,
                backgroundColor: colors.primary,
                borderWidth: 2,
                borderColor: "#fff",
                transform: [{ scale: breatheAnim }],
              }}
            />
          )}
        />
        <Text style={[styles.timeText, { color: colors.secondary }]}>
          {formatTime(duration)}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => {
            togglePlayMode();
            resetHideTimer();
          }}
        >
          <Ionicons
            name={getModeIconName(playMode)}
            size={24}
            color={colors.secondary}
          />
        </TouchableOpacity>

        <View style={styles.mainControls}>
          <TouchableOpacity
            onPress={() => {
              playPrevious();
              resetHideTimer();
            }}
          >
            <Ionicons name="play-skip-back" size={35} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              togglePlayback();
              resetHideTimer();
            }}
            style={[styles.playButton, { backgroundColor: colors.text }]}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={30}
              color={colors.background}
              style={{ marginLeft: isPlaying ? 0 : 4 }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              playNext();
              resetHideTimer();
            }}
          >
            <Ionicons name="play-skip-forward" size={35} color={colors.text} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => {
            setShowPlaylist(true);
            resetHideTimer();
          }}
        >
          <Ionicons name="list" size={24} color={colors.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLandscape) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <View style={styles.landscapeContainer}>
          <View style={[styles.landscapeLeft]}>
            <View style={styles.landscapeBackBtn}>
              <TouchableOpacity
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace("/(tabs)");
                  }
                }}
                style={styles.landscapeBackBtn}
              >
                <Ionicons name="chevron-down" size={30} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (needsAutoHide) {
                  setControlsVisible(!controlsVisible);
                }
              }}
              activeOpacity={1}
              style={[
                styles.landscapeArtworkContainer,
                !needsAutoHide && {
                  justifyContent: "flex-start",
                  paddingTop: "40%"
                },
              ]}
            >
              <Image
                source={{
                  uri: currentTrack.cover
                    ? typeof currentTrack.cover === "string" &&
                      currentTrack.cover.startsWith("http")
                      ? currentTrack.cover
                      : `${getBaseURL()}${currentTrack.cover}`
                    : "https://picsum.photos/400",
                }}
                onLayout={(e) => setArtworkHeight(e.nativeEvent.layout.height)}
                style={[styles.artwork, { marginBottom: 0 }]}
              />
            </TouchableOpacity>
            <Animated.View
              style={[
                styles.landscapeControls,
                {
                  opacity: controlsOpacity,
                  backgroundColor: colors.background,
                  borderRadius: 16,
                  padding: 10,
                  position: "absolute",
                  bottom: 20,
                  left: "10%",
                  zIndex: 20,
                },
              ]}
              onLayout={(e) => setControlsHeight(e.nativeEvent.layout.height)}
              pointerEvents={controlsVisible ? "auto" : "none"}
            >
              {renderControls()}
            </Animated.View>
          </View>

          <View style={styles.landscapeRight}>
            <View style={styles.landscapeContent}>
              {currentTrack.type === TrackType.AUDIOBOOK ? (
                renderPlaylist()
              ) : (
                <ScrollView
                  ref={scrollViewRef}
                  style={styles.lyricsScroll}
                  contentContainerStyle={styles.lyricsScrollContent}
                >
                  {parseLyrics(currentTrack.lyrics || "").map((line, index) => {
                    const isActive =
                      line.time <= position &&
                      (index ===
                        parseLyrics(currentTrack.lyrics || "").length - 1 ||
                        parseLyrics(currentTrack.lyrics || "")[index + 1].time >
                          position);

                    return (
                      <Text
                        key={index}
                        style={[
                          styles.lyricsLine,
                          {
                            color: isActive ? colors.primary : colors.secondary,
                          },
                          isActive && styles.activeLyricsLine,
                        ]}
                      >
                        {line.text}
                      </Text>
                    );
                  })}
                  {!currentTrack.lyrics && (
                    <Text
                      style={[styles.lyricsText, { color: colors.secondary }]}
                    >
                      暂无歌词
                    </Text>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-down" size={30} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setMoreModalVisible(true)}
        >
          <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={{ flex: 1, width: "100%", justifyContent: "center" }}>
          <View
            style={[
              styles.artworkContainer,
              showLyrics && { flex: 1, width: "100%" },
            ]}
          >
            {showLyrics ? (
              <View style={styles.lyricsContainer}>
                {currentTrack.lyrics ? (
                  <>
                    <View style={{ flex: 1, width: "100%" }}>
                      <ScrollView
                        ref={scrollViewRef}
                        style={styles.lyricsScroll}
                        contentContainerStyle={styles.lyricsScrollContent}
                      >
                        <Pressable
                          onPress={() => setShowLyrics(false)}
                          style={{ width: "100%", alignItems: "center" }}
                        >
                          {parseLyrics(currentTrack.lyrics).map(
                            (line, index) => {
                              const isActive =
                                line.time <= position &&
                                (index ===
                                  parseLyrics(currentTrack.lyrics!).length -
                                    1 ||
                                  parseLyrics(currentTrack.lyrics!)[index + 1]
                                    .time > position);

                              return (
                                <Text
                                  key={index}
                                  style={[
                                    styles.lyricsLine,
                                    {
                                      color: isActive
                                        ? colors.primary
                                        : colors.secondary,
                                    },
                                    isActive && styles.activeLyricsLine,
                                  ]}
                                >
                                  {line.text}
                                </Text>
                              );
                            }
                          )}
                        </Pressable>
                      </ScrollView>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.noLyricsContainer}
                    onPress={() => setShowLyrics(false)}
                  >
                    <Text
                      style={[styles.lyricsText, { color: colors.secondary }]}
                    >
                      暂无歌词
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.artworkContainer}
                activeOpacity={0.9}
                onPress={() => setShowLyrics(true)}
              >
                <Image
                  source={{
                    uri: currentTrack.cover
                      ? typeof currentTrack.cover === "string" &&
                        currentTrack.cover.startsWith("http")
                        ? currentTrack.cover
                        : `${getBaseURL()}${currentTrack.cover}`
                      : "https://picsum.photos/400",
                  }}
                  style={styles.artwork}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View>{renderControls()}</View>
      </View>
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
    paddingVertical: 10,
  },
  headerButton: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 2,
    paddingHorizontal: 30,
    justifyContent: "space-between",
  },
  artworkContainer: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    gap: 40,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  artwork: {
    width: 200,
    height: 200,
    borderRadius: 20,
    boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.3)",
  },
  lyricsContainer: {
    flex: 1,
    width: "100%",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  lyricsToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "center",
    marginBottom: 10,
  },
  lyricsToggleText: {
    fontSize: 12,
    opacity: 0.6,
  },
  noLyricsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lyricsScroll: {
    flex: 2,
    width: "100%",
  },
  lyricsScrollContent: {
    paddingVertical: 20,
    alignItems: "center",
  },
  lyricsLine: {
    fontSize: 16,
    textAlign: "center",
    marginVertical: 8,
    lineHeight: 24,
    opacity: 0.6,
  },
  activeLyricsLine: {
    fontSize: 18,
    fontWeight: "600",
    opacity: 1,
  },
  lyricsText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  trackInfo: {
    alignItems: "center",
    marginTop: 0,
  },
  trackTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "left",
    marginBottom: 5,
    height: 28, // Fix height for marquee layout stability
  },
  trackArtist: {
    fontSize: 14,
    textAlign: "left",
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  timeText: {
    fontSize: 12,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  mainControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 30,
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 16,
  },
  syncContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  syncButton: {
    padding: 0,
  },
  syncButtonActive: {
    // Optional active style
  },
  syncText: {
    fontSize: 12,
    fontWeight: "500",
  },
  textContainer: {
    flex: 1,
    alignItems: "flex-start",
    marginRight: 10,
  },
  rateButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
    minWidth: 45,
    alignItems: "center",
  },
  rateText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  likeButton: {
    padding: 0,
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 30,
    paddingHorizontal: 20,
  },
  landscapeContainer: {
    flex: 1,
    flexDirection: "row",
  },
  landscapeLeft: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  landscapeRight: {
    flex: 1,
    padding: 24,
    paddingTop: 34,
    paddingBottom: 14,
    justifyContent: "center",
  },
  landscapeArtwork: {
    width: 250,
    height: 250,
    borderRadius: 15,
    marginBottom: 20,
  },
  landscapeContent: {
    flex: 1,
    marginBottom: 20,
    justifyContent: "center",
  },
  landscapeBackBtn: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 10,
  },
  playlist: {
    flex: 1,
  },
  playlistItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  activePlaylistItem: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  playlistItemText: {
    fontSize: 16,
  },
  trackIndexContainer: {
    width: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  trackIndex: {
    fontSize: 14,
    textAlign: "center",
  },
  playlistItemCover: {
    width: 20,
    height: 20,
    borderRadius: 2,
  },
  modal: {
    margin: 0,
    justifyContent: "flex-end",
  },
  modalContent: {
    height: "60%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  modalItem: {
    padding: 15,
    borderBottomWidth: 0.5,
  },
  modalItemText: {
    fontSize: 16,
  },
  landscapeArtworkContainer: {
    flex: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  landscapeControls: {
    width: "100%",
    justifyContent: "center",
  },
});
