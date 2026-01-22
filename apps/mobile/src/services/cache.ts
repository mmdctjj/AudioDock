import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Track } from '../models';

const CACHE_DIR = `${FileSystem.documentDirectory || ''}audio_cache/`;
const OFFLINE_TRACKS_KEY = 'offline_tracks';

/**
 * Ensure the cache directory exists
 */
export const ensureCacheDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
};

/**
 * Get the local path for a track
 */
export const getLocalPath = (trackId: number | string, originalPath: string): string => {
  const extension = originalPath.split('.').pop() || 'mp3';
  return `${CACHE_DIR}${trackId}.${extension}`;
};

/**
 * Check if a track is cached locally
 */
export const isCached = async (trackId: number | string, originalPath: string): Promise<string | null> => {
  try {
    const localPath = getLocalPath(trackId, originalPath);
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    return fileInfo.exists ? localPath : null;
  } catch (e) {
    return null;
  }
};

const downloadPromises = new Map<number | string, Promise<string | null>>();

/**
 * Download a track to the local cache and save metadata
 */
export const downloadTrack = async (track: Track, url: string): Promise<string | null> => {
  if (downloadPromises.has(track.id)) {
    return downloadPromises.get(track.id)!;
  }

  const downloadPromise = (async () => {
    try {
      if (!url) return null;
      
      await ensureCacheDirExists();
      const localPath = getLocalPath(track.id, url);
      
      // Check if already exists to avoid redownloading
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        await saveTrackMetadata(track, localPath);
        return localPath;
      }

      console.log(`[Cache] Starting download for track ${track.id}: ${url}`);
      const downloadRes = await FileSystem.downloadAsync(url, localPath);
      if (downloadRes.status === 200) {
        console.log(`[Cache] Successfully downloaded track ${track.id} to ${localPath}`);
        await saveTrackMetadata(track, localPath);
        return localPath;
      }
      return null;
    } catch (e) {
      console.error(`[Cache] Failed to download track ${track.id}`, e);
      return null;
    } finally {
      downloadPromises.delete(track.id);
    }
  })();

  downloadPromises.set(track.id, downloadPromise);
  return downloadPromise;
};

/**
 * Save track metadata to AsyncStorage
 */
const saveTrackMetadata = async (track: Track, localPath: string) => {
  try {
    const stored = await AsyncStorage.getItem(OFFLINE_TRACKS_KEY);
    const tracks: Track[] = stored ? JSON.parse(stored) : [];
    
    const existingIndex = tracks.findIndex(t => t.id === track.id);
    // Overwrite path with local path for offline playback
    const trackWithLocalPath = { ...track, path: localPath };
    
    if (existingIndex > -1) {
      tracks[existingIndex] = trackWithLocalPath;
    } else {
      tracks.push(trackWithLocalPath);
    }
    
    await AsyncStorage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(tracks));
  } catch (e) {
    console.error("Failed to save track metadata", e);
  }
}

/**
 * Get all downloaded tracks
 */
export const getDownloadedTracks = async (): Promise<Track[]> => {
  try {
    const stored = await AsyncStorage.getItem(OFFLINE_TRACKS_KEY);
    if (!stored) return [];
    
    const tracks: Track[] = JSON.parse(stored);
    
    // Optional: Verify file existence and clean up
    const validTracks: Track[] = [];
    let hasChanges = false;

    for (const track of tracks) {
      if (track.path && await isCached(track.id, track.path)) {
        validTracks.push(track);
      } else {
        hasChanges = true;
      }
    }

    if (hasChanges) {
        await AsyncStorage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(validTracks));
    }

    return validTracks;
  } catch (e) {
    console.error("Failed to get downloaded tracks", e);
    return [];
  }
};

/**
 * Remove a downloaded track
 */
export const removeDownloadedTrack = async (trackId: number | string, url?: string) => {
    try {
        // Remove file
        if (url) {
            const localPath = getLocalPath(trackId, url);
            await FileSystem.deleteAsync(localPath, { idempotent: true });
        } else {
             // Try to find path from metadata
              const stored = await AsyncStorage.getItem(OFFLINE_TRACKS_KEY);
              if (stored) {
                  const tracks: Track[] = JSON.parse(stored);
                  const track = tracks.find(t => t.id === trackId);
                  if (track && track.path) {
                       // If path is already local (starts with file:// or contains audio_cache), use it directly?
                       // getLocalPath appends ID and extension. track.path IS the local path we saved.
                       // But wait, isCached checks getLocalPath(id, originalUrl).
                       // If we saved localPath to track.path, we can just delete it?
                       // Yes, if track.path is the file path.
                       // But earlier we used `getLocalPath` which derives name from ID + extension of ORIGINAL url.
                       // If we don't have original URL extension, we might fail to delete if we constructed the path wrong?
                       // But track.path should be the absolute local path we saved.
                       await FileSystem.deleteAsync(track.path, { idempotent: true });
                  }
              }
        }

        // Remove from metadata
        const stored = await AsyncStorage.getItem(OFFLINE_TRACKS_KEY);
        if (stored) {
            const tracks: Track[] = JSON.parse(stored);
            const newTracks = tracks.filter(t => t.id !== trackId);
            await AsyncStorage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(newTracks));
        }
    } catch (e) {
        console.error("Failed to remove downloaded track", e);
    }
}

/**
 * Format local path for TrackPlayer (ensuring file:// prefix)
 */
export const resolveLocalPath = (path: string): string => {
  if (path.startsWith('file://')) return path;
  if (path.startsWith('/')) return `file://${path}`;
  return path;
};

/**
 * Clear all cached audio files
 */
export const clearCache = async () => {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    await ensureCacheDirExists();
    await AsyncStorage.removeItem(OFFLINE_TRACKS_KEY);
  } catch (e) {
    console.error('Failed to clear cache', e);
  }
};

/**
 * Get cache size in bytes
 */
export const getCacheSize = async (): Promise<number> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) return 0;
    
    // FileSystem.getInfoAsync for a directory doesn't always return size correctly on all platforms
    // A more robust way would be to list all files and sum their sizes, but for simplicity:
    return (dirInfo as any).size || 0;
  } catch (e) {
    return 0;
  }
};
