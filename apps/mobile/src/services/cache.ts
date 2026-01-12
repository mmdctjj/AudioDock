import * as FileSystem from 'expo-file-system/legacy';

const CACHE_DIR = `${FileSystem.documentDirectory || ''}audio_cache/`;

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
export const getLocalPath = (trackId: number, originalPath: string): string => {
  const extension = originalPath.split('.').pop() || 'mp3';
  return `${CACHE_DIR}${trackId}.${extension}`;
};

/**
 * Check if a track is cached locally
 */
export const isCached = async (trackId: number, originalPath: string): Promise<string | null> => {
  try {
    const localPath = getLocalPath(trackId, originalPath);
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    return fileInfo.exists ? localPath : null;
  } catch (e) {
    return null;
  }
};

const downloadPromises = new Map<number, Promise<string | null>>();

/**
 * Download a track to the local cache
 */
export const downloadTrack = async (trackId: number, url: string): Promise<string | null> => {
  if (downloadPromises.has(trackId)) {
    return downloadPromises.get(trackId)!;
  }

  const downloadPromise = (async () => {
    try {
      await ensureCacheDirExists();
      const localPath = getLocalPath(trackId, url);
      
      // Check if already exists to avoid redownloading
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        return localPath;
      }

      console.log(`[Cache] Starting download for track ${trackId}: ${url}`);
      const downloadRes = await FileSystem.downloadAsync(url, localPath);
      if (downloadRes.status === 200) {
        console.log(`[Cache] Successfully downloaded track ${trackId} to ${localPath}`);
        return localPath;
      }
      return null;
    } catch (e) {
      console.error(`[Cache] Failed to download track ${trackId}`, e);
      return null;
    } finally {
      downloadPromises.delete(trackId);
    }
  })();

  downloadPromises.set(trackId, downloadPromise);
  return downloadPromise;
};

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
