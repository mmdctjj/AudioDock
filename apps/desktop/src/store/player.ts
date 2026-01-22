import { addAlbumToHistory, addToHistory, reportAudiobookProgress, toggleTrackLike, toggleTrackUnLike } from "@soundx/services";
import { create } from "zustand";
import { TrackType, type Track } from "../models";
import { getPlayMode } from "../utils/playMode";
import { useAuthStore } from "./auth";

interface PlayerModeState {
  currentTrack: Track | null;
  playlist: Track[];
  currentTime: number;
  duration: number;
  currentAlbumId: number | string | null;
}

interface PlayerState {
  // Active State (Proxy for UI)
  currentTrack: Track | null;
  playlist: Track[];
  currentTime: number;
  duration: number;
  currentAlbumId: number | string | null;

  // Global State
  isPlaying: boolean;
  playMode: "sequence" | "loop" | "shuffle" | "single";
  volume: number;
  activeMode: TrackType;

  // Persisted States
  modes: Record<TrackType, PlayerModeState>;

  // Actions
  play: (track?: Track, albumId?: number | string, startTime?: number) => void;
  pause: () => void;
  setPlaylist: (tracks: Track[]) => void;
  next: () => void;
  prev: () => void;
  setMode: (mode: "sequence" | "loop" | "shuffle" | "single") => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  toggleLike: (trackId: number | string, type: "like" | "unlike") => Promise<void>;
  removeTrack: (trackId: number | string) => void;

  // Internal/System Actions
  syncActiveMode: (mode: TrackType) => void;
  _saveCurrentStateToMode: () => void;
}

const DEFAULT_MODE_STATE: PlayerModeState = {
  currentTrack: null,
  playlist: [],
  currentTime: 0,
  duration: 0,
  currentAlbumId: null,
};

// Helper to load state from localStorage with safe defaults
const loadModeState = (mode: TrackType): PlayerModeState => {
  try {
    const key = `playerState_${mode}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_MODE_STATE, ...parsed };
    }
  } catch (e) {
    console.error(`Failed to load player state for ${mode}`, e);
  }
  return { ...DEFAULT_MODE_STATE };
};

const persistModeState = (mode: TrackType, state: PlayerModeState) => {
  try {
    localStorage.setItem(`playerState_${mode}`, JSON.stringify(state));
  } catch (e) {
    console.error(`Failed to persist player state for ${mode}`, e);
  }
};


export const usePlayerStore = create<PlayerState>((set, get) => {
  // Initialize
  const initialMode = getPlayMode(); // from utils
  const initialMusicState = loadModeState(TrackType.MUSIC);
  const initialAudiobookState = loadModeState(TrackType.AUDIOBOOK);

  const activeState = initialMode === TrackType.AUDIOBOOK ? initialAudiobookState : initialMusicState;
  
  // Load global settings
  const storedPlayMode = localStorage.getItem("playOrder") as "sequence" | "loop" | "shuffle" | "single" || "sequence";
  const storedVolume = Number(localStorage.getItem("playerVolume")) || 70;

  // Progress Reporting Helper
  let lastReportTime = 0;
  const ATTEMPT_REPORT_INTERVAL = 10; // Seconds

  const reportProgress = (state: PlayerState, force = false) => {
    const { currentTrack, currentTime, isPlaying, activeMode } = state;

    if (activeMode !== TrackType.AUDIOBOOK || !currentTrack) return;

    const roundedTime = Math.floor(currentTime);
    if (roundedTime <= 0) return;

    // Report if forced (e.g. pause/change) or interval met
    if (force || (isPlaying && Math.abs(roundedTime - lastReportTime) >= ATTEMPT_REPORT_INTERVAL)) {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;

      reportAudiobookProgress({
        userId,
        trackId: currentTrack.id,
        progress: roundedTime
      }).catch(e => console.error("Failed to report progress", e));
      lastReportTime = roundedTime;

      // Sync progress to local playlist and currentTrack
      const updatedPlaylist = state.playlist.map(t =>
        t.id === currentTrack.id ? { ...t, progress: roundedTime } : t
      );
      const updatedCurrentTrack = { ...currentTrack, progress: roundedTime };

      set({ playlist: updatedPlaylist, currentTrack: updatedCurrentTrack });
    }
  };

  return {
    // Spread active state properties to top level
    ...activeState,

    isPlaying: false,
    playMode: storedPlayMode,
    volume: storedVolume,
    activeMode: initialMode,

    modes: {
      [TrackType.MUSIC]: initialMusicState,
      [TrackType.AUDIOBOOK]: initialAudiobookState,
    },

    _saveCurrentStateToMode: () => {
      const state = get();
      const modeState: PlayerModeState = {
        currentTrack: state.currentTrack,
        playlist: state.playlist,
        currentTime: state.currentTime,
        duration: state.duration,
        currentAlbumId: state.currentAlbumId,
      };

      // Update the stored mode state in memory
      const newModes = { ...state.modes, [state.activeMode]: modeState };

      // Persist to localStorage
      persistModeState(state.activeMode, modeState);

      return newModes;
    },

    syncActiveMode: (newMode: TrackType) => {
      const state = get();
      if (state.activeMode === newMode) return;

      // 1. Save current active state to the old mode
      state._saveCurrentStateToMode(); // Valid because we called it, but we need to update state

      // Re-get updated modes (though _save returned them, simpler to just access properly if we were updating, but here we manually do it)
      const currentModeStateProxy: PlayerModeState = {
        currentTrack: state.currentTrack,
        playlist: state.playlist,
        currentTime: state.currentTime,
        duration: state.duration,
        currentAlbumId: state.currentAlbumId,
      };
      persistModeState(state.activeMode, currentModeStateProxy);

      const newModes = {
        ...state.modes,
        [state.activeMode]: currentModeStateProxy
      };

      // 2. Load state for new mode
      const nextModeState = newModes[newMode] || DEFAULT_MODE_STATE;

      set({
        activeMode: newMode,
        modes: newModes,
        // Apply next state
        currentTrack: nextModeState.currentTrack,
        playlist: nextModeState.playlist,
        currentTime: nextModeState.currentTime,
        duration: nextModeState.duration,
        currentAlbumId: nextModeState.currentAlbumId,
        isPlaying: false, // Pause on switch
      });
    },

    play: async (track, albumId, startTime) => {
      const { currentTrack, currentAlbumId, activeMode } = get();

      // If passing a track, logic is complex
      if (track) {
        if (currentTrack?.id !== track.id) {
          // Report progress of previous track before switching
          reportProgress(get(), true);
          lastReportTime = 0; // Reset for new track
          set({ currentTrack: track, isPlaying: true, currentTime: startTime || 0 });
          // Persist currentTrack change immediately.
          const state = get();
          persistModeState(activeMode, {
            currentTrack: track,
            playlist: state.playlist,
            currentTime: startTime || 0,
            duration: track.duration || 0,
            currentAlbumId: albumId || state.currentAlbumId
          });

          const deviceName =
            (await window.ipcRenderer?.getName()) || window.navigator.userAgent;
          const device = JSON.parse(localStorage.getItem("device") || "{}");

          // History Logic
          try {
            const userId = useAuthStore.getState().user?.id;
            if (userId) {
              await addToHistory(track.id, userId, startTime, deviceName, device.id, false);
            }
          } catch (e) {
            console.error("Failed to add track to history", e);
          }

          if (albumId && albumId !== currentAlbumId) {
            set({ currentAlbumId: albumId });
            try {
              const userId = useAuthStore.getState().user?.id;
              if (userId) {
                await addAlbumToHistory(albumId, userId);
              }
            } catch (e) {
              console.error("Failed to add album to history", e);
            }
          }
        } else {
          set({ isPlaying: true });
          // If resuming same track, should we jump to startTime?
          // Usually play() on same track just resumes. 
          // But if startTime is provided and > 0, we might want to seek?
          // For now, let's assume if track is same, we respect existing currentTime unless startTime is explicit?
          if (startTime !== undefined) {
            // And audio element will pick it up via useEffect if we implement it there? 
            // Currently store just sets state. Player component needs to react to currentTime change if it's a seek.
            // But existing logic: setCurrentTime doesn't seek audio element directly, handleSeek does.
            // However, handleLoadedMetadata restores it.
            // Converting this to a seek is hard without ref. 
            // But if we change track, currentTime resets to 0 (or startTime). 
            // If track is same, we might need a way to force seek.
            // But "Resume" implies we are loading the track. 
            // If track is same, we probably don't need to do anything if it's already there. 
            // If it's paused, we just play. 
            // If user clicked "Continue", and we are at 0:00, but history says 10:00, we should jump.
            if (startTime > 0) {
              set({ currentTime: startTime });
            }
          }
        }
      } else {
        if (currentTrack) {
          set({ isPlaying: true });
        }
      }
    },

    pause: () => {
      reportProgress(get(), true); // Report immediately on pause
      set({ isPlaying: false });
      // Good time to save progress
      const s = get();
      persistModeState(s.activeMode, {
        currentTrack: s.currentTrack,
        playlist: s.playlist,
        currentTime: s.currentTime,
        duration: s.duration,
        currentAlbumId: s.currentAlbumId
      });
    },

    setPlaylist: (tracks: Track[]) => {
      set({ playlist: tracks });
      const s = get();
      persistModeState(s.activeMode, {
        ...s, // this spreads too much, but essentially we want current state properties
        currentTrack: s.currentTrack,
        playlist: tracks,
        currentTime: s.currentTime,
        duration: s.duration,
        currentAlbumId: s.currentAlbumId
      } as PlayerModeState);
    },

    next: () => {
      const { playlist, currentTrack, playMode, activeMode } = get();
      if (!currentTrack || playlist.length === 0) return;

      const currentIndex = playlist.findIndex((t: Track) => t.id === currentTrack.id);
      let nextIndex = currentIndex + 1;

      if (playMode === "shuffle") {
        nextIndex = Math.floor(Math.random() * playlist.length);
      } else if (playMode === "loop") {
        if (nextIndex >= playlist.length) {
          nextIndex = 0;
        }
      } else {
        if (nextIndex >= playlist.length) return;
      }

      // Report previous track
      reportProgress(get(), true);
      lastReportTime = 0;

      const nextTrack = playlist[nextIndex];
      set({ currentTrack: nextTrack, isPlaying: true, currentTime: 0 });

      const userId = useAuthStore.getState().user?.id;
      if (userId) {
        addToHistory(nextTrack.id, userId).catch(console.error);
      }

      // Persist
      const s = get();
      persistModeState(activeMode, {
        currentTrack: nextTrack,
        playlist: s.playlist,
        currentTime: 0, // Reset time on new track
        duration: 0,
        currentAlbumId: s.currentAlbumId
      } as PlayerModeState);
    },

    prev: () => {
      const { playlist, currentTrack, activeMode } = get();
      if (!currentTrack || playlist.length === 0) return;

      const currentIndex = playlist.findIndex((t: Track) => t.id === currentTrack.id);
      const prevIndex = currentIndex - 1;

      if (prevIndex < 0) return;

      // Report previous track
      reportProgress(get(), true);
      lastReportTime = 0;

      const prevTrack = playlist[prevIndex];
      set({ currentTrack: prevTrack, isPlaying: true, currentTime: 0 });

      const userId = useAuthStore.getState().user?.id;
      if (userId) {
        addToHistory(prevTrack.id, userId).catch(console.error);
      }

      // Persist
      const s = get();
      persistModeState(activeMode, {
        currentTrack: prevTrack,
        playlist: s.playlist,
        currentTime: 0,
        duration: 0,
        currentAlbumId: s.currentAlbumId
      } as PlayerModeState);
    },

    setMode: (mode) => set({ playMode: mode }),
    setVolume: (volume) => set({ volume }),

    setCurrentTime: (time) => {
      set({ currentTime: time });
      // Check for progress reporting (throttled by reportProgress logic)
      reportProgress(get());
      // Don't persist on every second, pointless & heavy. Persist on pause/change/unload.
    },

    setDuration: (duration) => set({ duration }),

    toggleLike: async (trackId, type) => {
      try {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
          console.warn("User not logged in, cannot toggle like");
          return;
        }
        await (type === "like" ? toggleTrackLike(trackId, userId) : toggleTrackUnLike(trackId, userId));
        
        const state = get();
        const updateTrack = (track: Track) => {
          if (track.id !== trackId) return track;
          let likedByUsers = track.likedByUsers || [];
          if (type === 'like') {
            if (!likedByUsers.some(l => l.userId === userId)) {
               likedByUsers = [...likedByUsers, {
                 id: 0, 
                 trackId: trackId,
                 userId: userId,
                 createdAt: new Date()
               }];
            }
          } else {
            likedByUsers = likedByUsers.filter(l => l.userId !== userId);
          }
          return { ...track, likedByUsers };
        };

        const newCurrentTrack = state.currentTrack ? updateTrack(state.currentTrack) : null;
        const newPlaylist = state.playlist.map(updateTrack);

        set({ 
          currentTrack: newCurrentTrack,
          playlist: newPlaylist
        });

        // Save progress/state to localStorage
        state._saveCurrentStateToMode();
        
      } catch (e) {
        console.error("Failed to toggle like", e);
      }
    },

    removeTrack: (trackId) => {
      const { currentTrack, playlist, pause, activeMode } = get();

      // If current track is being deleted, pause first
      if (currentTrack?.id === trackId) {
        pause();
        set({ currentTrack: null, currentTime: 0 });
      }

      const updatedPlaylist = playlist.filter(t => t.id !== trackId);
      set({ playlist: updatedPlaylist });

      // Persist changes
      const s = get();
      persistModeState(activeMode, {
        currentTrack: s.currentTrack,
        playlist: updatedPlaylist,
        currentTime: s.currentTime,
        duration: s.duration,
        currentAlbumId: s.currentAlbumId
      });
    }
  };
});
