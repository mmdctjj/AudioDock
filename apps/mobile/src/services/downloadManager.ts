import { getBaseURL } from "../https";
import { Track } from "../models";
import { downloadTrack as cacheDownloadTrack } from "./cache";

export const downloadTrack = async (track: Track): Promise<boolean> => {
  try {
    const url = track.path.startsWith("http")
      ? track.path
      : `${getBaseURL()}${track.path}`;
    
    const localPath = await cacheDownloadTrack(track, url);
    return !!localPath;
  } catch (error) {
    console.error(`[DownloadManager] Failed to download track ${track.id}`, error);
    return false;
  }
};

export const downloadTracks = async (
  tracks: Track[],
  onProgress?: (completed: number, total: number) => void
): Promise<void> => {
  let completed = 0;
  const total = tracks.length;

  // For mobile, downloading in parallel might be too intensive, 
  // but let's do them one by one for progress reporting and stability.
  for (const track of tracks) {
    await downloadTrack(track);
    completed++;
    if (onProgress) {
      onProgress(completed, total);
    }
  }
};
