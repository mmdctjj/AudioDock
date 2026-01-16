import { getBaseURL } from "../https";
import type { Track } from "../models";
import { useAuthStore } from "../store/auth";
import { useSettingsStore } from "../store/settings";

export const downloadTrack = async (track: Track): Promise<boolean> => {
  if (!(window as any).ipcRenderer) return false;

  const settings = useSettingsStore.getState();
  const downloadPath = settings.download.downloadPath;
  const token = useAuthStore.getState().token;
  const albumName = track.albumEntity?.name || track.album || "Unknown Album";

  let remoteUri = "";
  if (track.path) {
    remoteUri = track.path.startsWith("http")
      ? track.path
      : `${getBaseURL()}${track.path}`;
  }

  if (!remoteUri) return false;

  const metadata = {
    id: track.id,
    path: track.path,
    name: track.name,
    artist: track.artist,
    album: albumName,
    albumId: track.albumEntity?.id || (track as any).albumId,
    duration: track.duration,
    type: track.type,
    cover: track.cover ? (track.cover.startsWith('http') ? track.cover : `${getBaseURL()}${track.cover}`) : null,
    lyrics: track.lyrics
  };

  try {
    const res = await (window as any).ipcRenderer.invoke(
      "cache:download",
      track.id,
      remoteUri,
      downloadPath,
      track.type,
      albumName,
      metadata,
      token
    );
    return !!res;
  } catch (error) {
    console.error(`[DownloadManager] Failed to download track ${track.id}`, error);
    return false;
  }
};

export const downloadTracks = async (tracks: Track[], onProgress?: (completed: number, total: number) => void): Promise<void> => {
  let completed = 0;
  const total = tracks.length;

  // We can do them in batches or one by one. One by one is safer for simple progress.
  for (const track of tracks) {
    await downloadTrack(track);
    completed++;
    if (onProgress) {
        onProgress(completed, total);
    }
  }
};
