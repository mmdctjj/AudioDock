import AsyncStorage from "@react-native-async-storage/async-storage";
import { addAlbumToHistory, addToHistory, getLatestHistory, reportAudiobookProgress } from "@soundx/services";
import * as Device from "expo-device";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  IOSCategory,
  IOSCategoryMode,
  IOSCategoryOptions,
  State,
  useProgress,
  useTrackPlayerEvents,
} from "react-native-track-player";
import { getBaseURL } from "../https";
import { Track, TrackType } from "../models";
import { downloadTrack, isCached } from "../services/cache";
import { socketService } from "../services/socket";
import { PLAYER_EVENTS, playerEventEmitter } from "../utils/playerEvents";
import { usePlayMode } from "../utils/playMode";
import { useAuth } from "./AuthContext";
import { useNotification } from "./NotificationContext";
import { useSettings } from "./SettingsContext";
import { useSync } from "./SyncContext";

export enum PlayMode {
  SEQUENCE = "SEQUENCE",
  LOOP_LIST = "LOOP_LIST",
  SHUFFLE = "SHUFFLE",
  LOOP_SINGLE = "LOOP_SINGLE",
  SINGLE_ONCE = "SINGLE_ONCE",
}

interface PlayerContextType {
  isPlaying: boolean;
  currentTrack: Track | null;
  position: number;
  duration: number;
  isLoading: boolean;
  playTrack: (track: Track, initialPosition?: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  trackList: Track[];
  playTrackList: (tracks: Track[], index: number) => Promise<void>;
  playMode: PlayMode;
  togglePlayMode: () => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  isSynced: boolean;
  sessionId: string | null;
  handleDisconnect: () => void;
  showPlaylist: boolean;
  setShowPlaylist: (show: boolean) => void;
  sleepTimer: number | null;
  setSleepTimer: (minutes: number) => void;
  clearSleepTimer: () => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType>({
  isPlaying: false,
  currentTrack: null,
  position: 0,
  duration: 0,
  isLoading: false,
  playTrack: async () => {},
  pause: async () => {},
  resume: async () => {},
  seekTo: async () => {},
  trackList: [],
  playTrackList: async () => {},
  playMode: PlayMode.SEQUENCE,
  togglePlayMode: () => {},
  playNext: async () => {},
  playPrevious: async () => {},
  isSynced: false,
  sessionId: null,
  handleDisconnect: () => {},
  showPlaylist: false,
  setShowPlaylist: () => {},
  sleepTimer: null,
  setSleepTimer: () => {},
  clearSleepTimer: () => {},
  playbackRate: 1,
  setPlaybackRate: async () => {},
});

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, device, isLoading: isAuthLoading } = useAuth();
  const { mode } = usePlayMode();
  const { showNotification } = useNotification();
  const { acceptRelay, cacheEnabled } = useSettings();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [trackList, setTrackList] = useState<Track[]>([]);
  const [playMode, setPlayMode] = useState<PlayMode>(PlayMode.SEQUENCE);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sleepTimer, setSleepTimerState] = useState<number | null>(null);
  const [playbackRate, setPlaybackRateState] = useState(1);

  const prevModeRef = useRef(mode);
  const isInitialLoadRef = useRef(true);

  // Hook for progress
  const { position, duration } = useProgress();

  // Refs for accessing latest state in callbacks
  const playModeRef = React.useRef(playMode);
  const trackListRef = React.useRef(trackList);
  const currentTrackRef = React.useRef(currentTrack);
  const positionRef = React.useRef(position);
  const playbackRateRef = React.useRef(playbackRate);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    trackListRef.current = trackList;
  }, [trackList]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  // Setup Player
  useEffect(() => {
    const setupPlayer = async () => {
      try {
        // 1️⃣ 只在 setupPlayer 里配置 iOS Audio Session
        await TrackPlayer.setupPlayer({
          iosCategory: IOSCategory.Playback,
          iosCategoryMode: IOSCategoryMode.Default,
          iosCategoryOptions: [
            IOSCategoryOptions.AllowBluetooth,
            IOSCategoryOptions.AllowBluetoothA2DP,
            IOSCategoryOptions.AllowAirPlay,
            IOSCategoryOptions.DuckOthers,
          ],
        });

        // 2️⃣ 只调用一次 updateOptions（不要再 platform 分支）
        await TrackPlayer.updateOptions({
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.Stop,
            Capability.SeekTo,
          ],
          // compactCapabilities: [
          //   Capability.Play,
          //   Capability.Pause,
          //   Capability.SkipToNext,
          //   Capability.SkipToPrevious,
          // ],
          progressUpdateEventInterval: 2,

          android: {
            appKilledPlaybackBehavior:
              AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          },
        });

        setIsSetup(true);
      } catch (error: any) {
        if (error?.message?.includes("already been initialized")) {
          setIsSetup(true);
        } else {
          console.error("[TrackPlayer] setup failed", error);
        }
      }
    };

    setupPlayer();
  }, []);

  // Sync isPlaying state with TrackPlayer events
  useTrackPlayerEvents(
    [Event.PlaybackState, Event.PlaybackError, Event.PlaybackQueueEnded],
    async (event) => {
      if (event.type === Event.PlaybackError) {
        console.error(
          "An error occurred while playing the current track.",
          event
        );
      }
      if (event.type === Event.PlaybackState) {
        setIsPlaying(event.state === State.Playing);
        setIsLoading(
          event.state === State.Buffering || event.state === State.Loading
        );
      }
      if (event.type === Event.PlaybackQueueEnded) {
        playNext();
      }
    }
  );

  const getNextIndex = (
    currentIndex: number,
    mode: PlayMode,
    list: Track[]
  ) => {
    if (list.length === 0) return -1;
    switch (mode) {
      case PlayMode.SEQUENCE:
        return currentIndex + 1 < list.length ? currentIndex + 1 : -1;
      case PlayMode.LOOP_LIST:
        return (currentIndex + 1) % list.length;
      case PlayMode.SHUFFLE:
        return Math.floor(Math.random() * list.length);
      case PlayMode.LOOP_SINGLE:
        return currentIndex;
      case PlayMode.SINGLE_ONCE:
        return -1;
      default:
        return currentIndex + 1 < list.length ? currentIndex + 1 : -1;
    }
  };

  const getPreviousIndex = (
    currentIndex: number,
    mode: PlayMode,
    list: Track[]
  ) => {
    if (list.length === 0) return -1;
    if (currentIndex > 0) return currentIndex - 1;
    return list.length - 1;
  };

  const playNext = async () => {
    const list = trackListRef.current;

    // If Loop Single, just seek to 0 and play
    if (playModeRef.current === PlayMode.LOOP_SINGLE) {
      await seekTo(0);
      return;
    }

    const current = currentTrackRef.current;
    if (!current || list.length === 0) return;

    const currentIndex = list.findIndex((t) => t.id === current.id);
    if (currentIndex === -1) return;

    const nextIndex = getNextIndex(currentIndex, playModeRef.current, list);
    if (nextIndex !== -1) {
      await playTrack(list[nextIndex]);
    } else {
      await TrackPlayer.pause();
    }
  };

  const playPrevious = async () => {
    const list = trackListRef.current;
    const current = currentTrackRef.current;
    if (!current || list.length === 0) return;

    const currentIndex = list.findIndex((t) => t.id === current.id);
    if (currentIndex === -1) return;

    const prevIndex = getPreviousIndex(currentIndex, playModeRef.current, list);
    if (prevIndex !== -1) {
      await playTrack(list[prevIndex]);
    }
  };

  // Handle lock screen / control center buttons via shared event emitter
  useEffect(() => {
    const onRemoteNext = () => playNext();
    const onRemotePrev = () => playPrevious();

    playerEventEmitter.on(PLAYER_EVENTS.REMOTE_NEXT, onRemoteNext);
    playerEventEmitter.on(PLAYER_EVENTS.REMOTE_PREVIOUS, onRemotePrev);

    return () => {
      playerEventEmitter.removeListener(
        PLAYER_EVENTS.REMOTE_NEXT,
        onRemoteNext
      );
      playerEventEmitter.removeListener(
        PLAYER_EVENTS.REMOTE_PREVIOUS,
        onRemotePrev
      );
    };
  }, [playNext, playPrevious]);

  const togglePlayMode = () => {
    const modes = Object.values(PlayMode);
    const currentIndex = modes.indexOf(playMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setPlayMode(nextMode);
    savePlaybackState(mode);
  };

  // Persistence logic
  const savePlaybackState = async (targetMode: string) => {
    if (!currentTrackRef.current || !isSetup) return;
    const state = {
      currentTrack: currentTrackRef.current,
      trackList: trackListRef.current,
      position: positionRef.current,
      playMode: playModeRef.current,
      playbackRate: playbackRateRef.current,
    };
    try {
      await AsyncStorage.setItem(
        `playbackState_${targetMode}`,
        JSON.stringify(state)
      );
    } catch (e) {
      console.error("Failed to save playback state", e);
    }
  };

  const loadPlaybackState = async (targetMode: string) => {
    if (!isSetup) return;
    try {
      const saved = await AsyncStorage.getItem(`playbackState_${targetMode}`);
      if (saved) {
        const state = JSON.parse(saved);
        setTrackList(state.trackList);
        setPlayMode(state.playMode);
        if (state.playbackRate) {
          setPlaybackRateState(state.playbackRate);
        }
        if (state.currentTrack) {
          const track = state.currentTrack;
          const uri = track.path.startsWith("http")
            ? track.path
            : `${getBaseURL()}${track.path}`;
          const artwork = track.cover
            ? track.cover.startsWith("http")
              ? track.cover
              : `${getBaseURL()}${track.cover}`
            : undefined;

          await TrackPlayer.reset();
          await TrackPlayer.add({
            id: String(track.id),
            url: uri,
            title: track.name,
            artist: track.artist,
            album: track.album || "Unknown Album",
            artwork: artwork,
            duration: track.duration || 0,
          });

          if (state.position) {
            await TrackPlayer.seekTo(state.position);
          }

          setCurrentTrack(track);
        }
      } else {
        setCurrentTrack(null);
        setTrackList([]);
        await TrackPlayer.reset();
      }
    } catch (e) {
      console.error("Failed to load playback state", e);
    }
  };

  // Mode switching & Initial Load Persistence
  useEffect(() => {
    if (!isSetup || isAuthLoading) return;

    const handleModeChange = async () => {
      if (isInitialLoadRef.current) {
        await loadPlaybackState(mode);
        isInitialLoadRef.current = false;
        prevModeRef.current = mode;
      } else if (prevModeRef.current !== mode) {
        await savePlaybackState(prevModeRef.current);
        await loadPlaybackState(mode);
        prevModeRef.current = mode;
      }
    };

    handleModeChange();
  }, [mode, isSetup, isAuthLoading]);

  // Periodic persistence
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && isSetup) {
        savePlaybackState(mode);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isPlaying, isSetup, mode]);

  const playTrack = async (track: Track, initialPosition?: number) => {
    if (!isSetup) return;
    try {
      const uri = track.path.startsWith("http")
        ? track.path
        : `${getBaseURL()}${track.path}`;

      const artwork = track.cover
        ? track.cover.startsWith("http")
          ? track.cover
          : `${getBaseURL()}${track.cover}`
        : undefined;
      console.log("Playing track:", track);

      let playUri = uri;

      if (cacheEnabled && track.id) {
        const localPath = await isCached(track.id, track.path);
        if (localPath) {
          console.log("Playing from cache:", localPath);
          playUri = localPath;
        } else {
          console.log("Not cached, starting background download");
          // Don't wait for download, just start it
          downloadTrack(track.id, uri).catch((e) =>
            console.error("Cache download failed", e)
          );
        }
      }

      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: String(track.id),
        url: playUri,
        title: track.name,
        artist: track.artist,
        album: track.album || "Unknown Album",
        artwork: artwork,
        duration: track.duration || 0,
      });

      // Update capabilities (Universal for all track types)
      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
          Capability.SeekTo,
        ],
        // compactCapabilities: [
        //   Capability.Play,
        //   Capability.Pause,
        //   Capability.SkipToNext,
        //   Capability.SkipToPrevious,
        // ],
      });

      if (initialPosition) {
        await TrackPlayer.seekTo(initialPosition);
      }

      await TrackPlayer.play();
      // Optimistically set current track for UI
      setCurrentTrack(track);
      savePlaybackState(mode);
    } catch (error) {
      console.error("Failed to play track:", error);
    }
  };

  const playTrackList = async (tracks: Track[], index: number) => {
    setTrackList(tracks);
    if (tracks[index]) {
      await playTrack(tracks[index]);
      savePlaybackState(mode);
    }
  };

  const broadcastSync = (type: string, data?: any) => {
    if (isSynced && sessionId && !isProcessingSync.current) {
      socketService.emit("sync_command", {
        sessionId,
        type,
        data,
      });
    }
  };

  const pause = async () => {
    if (isSetup) {
      try {
        await TrackPlayer.pause();
        savePlaybackState(mode);
      } catch (error) {
        console.error("Failed to pause:", error);
      }
    }
  };

  const resume = async () => {
    if (isSetup) {
      try {
        await TrackPlayer.play();
        savePlaybackState(mode);
      } catch (error) {
        console.error("Failed to resume:", error);
      }
    }
  };

  const seekTo = async (pos: number) => {
    if (isSetup) {
      try {
        await TrackPlayer.seekTo(pos);
        broadcastSync("seek", pos);
      } catch (error) {
        console.error("Failed to seek:", error);
      }
    }
  };

  const setPlaybackRate = async (rate: number) => {
    if (isSetup) {
      try {
        await TrackPlayer.setRate(rate);
        setPlaybackRateState(rate);
        savePlaybackState(mode);
      } catch (error) {
        console.error("Failed to set playback rate:", error);
      }
    }
  };

  const handleDisconnect = () => {
    Alert.alert("结束同步播放", "确定要断开连接吗？", [
      {
        text: "取消",
        style: "cancel",
      },
      {
        text: "确定",
        onPress: () => {
          console.log("User confirmed disconnect", sessionId);
          if (sessionId) {
            socketService.emit("player_left", { sessionId });
            setSynced(false, null);
            setParticipants([]);
          }
        },
      },
    ]);
  };

  const recordHistory = async () => {
    if (currentTrackRef.current && user) {
      const deviceName = Device.modelName || "Mobile Device";
      const deviceId = device?.id;

      try {
        await addToHistory(
          currentTrackRef.current.id,
          user.id,
          Math.floor(positionRef.current),
          deviceName,
          deviceId,
          isSynced
        );

        if (currentTrackRef.current.albumId) {
          await addAlbumToHistory(currentTrackRef.current.albumId, user.id);
        }

        if (currentTrackRef.current.type === TrackType.AUDIOBOOK) {
          await reportAudiobookProgress({
            userId: user.id,
            trackId: currentTrackRef.current.id,
            progress: Math.floor(positionRef.current),
          });
        }
      } catch (e) {
        // Silence background network errors for history recording
        console.log(
          "Background history sync skipped due to network/transient error"
        );
      }
    }
  };

  const isProcessingSync = useRef(false);
  const {
    isSynced,
    sessionId,
    setSynced,
    setParticipants,
    lastAcceptedInvite,
  } = useSync();

  // Sync Event Handlers - only active when synced
  useEffect(() => {
    if (isSynced && sessionId) {
      const handleSyncEvent = (payload: {
        type: string;
        data: any;
        fromUserId: number;
      }) => {
        if (payload.fromUserId === user?.id) return;

        isProcessingSync.current = true;

        switch (payload.type) {
          case "play":
            resume();
            break;
          case "pause":
            pause();
            break;
          case "seek":
            seekTo(payload.data);
            break;
          case "track_change":
            playTrack(payload.data);
            break;
          case "playlist":
            setTrackList(payload.data);
            break;
          case "leave":
            console.log("Participant left the session");
            Alert.alert("同步状态", "对方已断开同步连接");
            break;
        }

        setTimeout(() => {
          isProcessingSync.current = false;
        }, 100);
      };

      const handleRequestInitialState = (payload: {
        sessionId: string;
        fromSocketId: string;
      }) => {
        if (currentTrack) {
          socketService.emit("sync_command", {
            sessionId: payload.sessionId,
            type: "track_change",
            data: currentTrack,
            targetSocketId: payload.fromSocketId,
          });

          setTimeout(() => {
            socketService.emit("sync_command", {
              sessionId: payload.sessionId,
              type: isPlaying ? "play" : "pause",
              data: position,
              targetSocketId: payload.fromSocketId,
            });
          }, 200);
        }
      };

      socketService.on("sync_event", handleSyncEvent);
      socketService.on("request_initial_state", handleRequestInitialState);

      return () => {
        socketService.off("sync_event", handleSyncEvent);
        socketService.off("request_initial_state", handleRequestInitialState);
      };
    }
  }, [isSynced, sessionId, currentTrack, isPlaying, position]);

  // Handle initial playback when session starts (for invited users)
  useEffect(() => {
    if (isSynced && lastAcceptedInvite && !currentTrack) {
      console.log("Applying invite context: playlist and track");
      if (lastAcceptedInvite.playlist) {
        setTrackList(lastAcceptedInvite.playlist);
      }
      if (lastAcceptedInvite.currentTrack) {
        // playTrack(lastAcceptedInvite.currentTrack, lastAcceptedInvite.progress);
        // Important: Wait for player setup before applying
        if (isSetup) {
          playTrack(
            lastAcceptedInvite.currentTrack,
            lastAcceptedInvite.progress
          );
        }
      }
    }
  }, [isSynced, lastAcceptedInvite, isSetup]);

  // Global session event handlers - always active
  useEffect(() => {
    const handleSessionEnded = () => {
      Alert.alert("同步状态", "同步播放已结束");
      setSynced(false, null);
      setParticipants([]);
      console.log("Sync session ended");
    };

    const handlePlayerLeft = (payload: {
      username: string;
      deviceName: string;
    }) => {
      Alert.alert(
        "同步状态",
        `${payload.username} (${payload.deviceName}) 已断开同步连接`
      );
    };

    socketService.on("session_ended", handleSessionEnded);
    socketService.on("player_left", handlePlayerLeft);

    return () => {
      socketService.off("session_ended", handleSessionEnded);
      socketService.off("player_left", handlePlayerLeft);
    };
  }, [setSynced, setParticipants]);

  // Broadcast local changes
  useEffect(() => {
    if (isSynced && sessionId && !isProcessingSync.current) {
      socketService.emit("sync_command", {
        sessionId,
        type: isPlaying ? "play" : "pause",
        data: null,
      });
    }
  }, [isPlaying, isSynced, sessionId]);

  useEffect(() => {
    if (isSynced && sessionId && !isProcessingSync.current && currentTrack) {
      socketService.emit("sync_command", {
        sessionId,
        type: "track_change",
        data: currentTrack,
      });
    }
  }, [currentTrack?.id, isSynced, sessionId]);

  useEffect(() => {
    if (
      isSynced &&
      sessionId &&
      !isProcessingSync.current &&
      trackList.length > 0
    ) {
      socketService.emit("sync_command", {
        sessionId,
        type: "playlist",
        data: trackList,
      });
    }
  }, [trackList, isSynced, sessionId]);

  // History Recording
  useEffect(() => {
    if (currentTrack) {
      recordHistory();
    }
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!isPlaying && currentTrack) {
      recordHistory();
    }
  }, [isPlaying]);

  // Periodic History Sync
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        recordHistory();
      }, 15000); // Sync every 15 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  // Check Resume on mount
  useEffect(() => {
    if (user && isSetup && acceptRelay) {
      const checkResume = async () => {
        try {
          const res = await getLatestHistory(user.id);
          if (res.code === 200 && res.data) {
            const history = res.data;
            const deviceName = Device.modelName || "Mobile Device";

            const diff =
              new Date().getTime() - new Date(history.listenedAt).getTime();
            const isRecent = diff < 24 * 60 * 60 * 1000;
            const isOtherDevice = history.deviceName !== deviceName;

            if (isRecent && isOtherDevice && history.track) {
              const m = Math.floor(history.progress / 60);
              const s = Math.floor(history.progress % 60)
                .toString()
                .padStart(2, "0");
              showNotification({
                type: "resume",
                track: history.track,
                title: "继续播放",
                description: `发现在设备 ${history.deviceName} 上的播放记录，是否从 ${m}:${s} 继续播放？`,
                onAccept: () => playTrack(history.track, history.progress),
                onReject: () => {},
              });
            }
          }
        } catch (e) {
          console.error("Check resume error", e);
        }
      };
      checkResume();
    }
  }, [user?.id, isSetup]);

  // Sleep Timer Functions
  const setSleepTimer = (minutes: number) => {
    const expiryTime = Date.now() + minutes * 60 * 1000;
    setSleepTimerState(expiryTime);
  };

  const clearSleepTimer = () => {
    setSleepTimerState(null);
  };

  // Monitor Sleep Timer
  useEffect(() => {
    if (!sleepTimer || !isPlaying) return;

    const checkTimer = setInterval(() => {
      if (Date.now() >= sleepTimer) {
        pause();
        setSleepTimerState(null);
      }
    }, 1000);

    return () => clearInterval(checkTimer);
  }, [sleepTimer, isPlaying]);

  return (
    <PlayerContext.Provider
      value={{
        isPlaying,
        currentTrack,
        position,
        duration,
        isLoading,
        playTrack,
        pause,
        resume,
        seekTo,
        trackList,
        playTrackList,
        playMode,
        togglePlayMode,
        playNext,
        playPrevious,
        isSynced,
        sessionId,
        handleDisconnect,
        showPlaylist,
        setShowPlaylist,
        sleepTimer,
        setSleepTimer,
        clearSleepTimer,
        playbackRate,
        setPlaybackRate,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
