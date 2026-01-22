import { ISuccessResponse, Playlist, TrackType } from "../../models";
import { IPlaylistAdapter } from "../interface";
import { SubsonicClient } from "./client";

export class SubsonicPlaylistAdapter implements IPlaylistAdapter {
  constructor(private client: SubsonicClient) {}

  private response<T>(data: T): ISuccessResponse<T> {
    return {
      code: 200,
      message: "success",
      data
    };
  }

  async createPlaylist(name: string, type: "MUSIC" | "AUDIOBOOK", userId: number | string): Promise<ISuccessResponse<Playlist>> {
    const res = await this.client.get<{ playlist: any }>("createPlaylist", { name });
    return this.response(this.mapPlaylist(res.playlist));
  }

  async getPlaylists(type?: "MUSIC" | "AUDIOBOOK", userId?: number | string): Promise<ISuccessResponse<Playlist[]>> {
    const res = await this.client.get<{ playlists: { playlist: any[] } }>("getPlaylists");
    const list = (res.playlists?.playlist || []).map(p => this.mapPlaylist(p));
    // Subsonic doesn't filter by type in API easily, maybe filter here?
    // Music vs Audiobook usually depends on how user organizes.
    return this.response(list);
  }

  async getPlaylistById(id: number | string): Promise<ISuccessResponse<Playlist>> {
    const res = await this.client.get<{ playlist: any }>("getPlaylist", { id: id.toString() });
    return this.response(this.mapPlaylist(res.playlist));
  }

  async updatePlaylist(id: number | string, name: string): Promise<ISuccessResponse<Playlist>> {
    await this.client.get("updatePlaylist", { playlistId: id.toString(), name });
    // Fetch refreshed
    return await this.getPlaylistById(id);
  }

  async deletePlaylist(id: number | string): Promise<ISuccessResponse<boolean>> {
    await this.client.get("deletePlaylist", { id: id.toString() });
    return this.response(true);
  }

  async addTrackToPlaylist(playlistId: number | string, trackId: number | string): Promise<ISuccessResponse<boolean>> {
    await this.client.get("updatePlaylist", { playlistId: playlistId.toString(), songIdToAdd: trackId.toString() });
    return this.response(true);
  }

  async addTracksToPlaylist(playlistId: number | string, trackIds: (number | string)[]): Promise<ISuccessResponse<boolean>> {
    // Subsonic updatePlaylist can take multiple songIdToAdd parameters?
    // The documentation says "songIdToAdd: Add this song to the playlist. Can be used more than once."
    // SubsonicClient.get/post doesn't support multiple same-key params in object easily if using Axios params.
    // We should probably iterate or find a way.
    // For now, iterate:
    for (const tid of trackIds) {
        await this.addTrackToPlaylist(playlistId, tid);
    }
    return this.response(true);
  }

  async removeTrackFromPlaylist(playlistId: number | string, trackId: number | string): Promise<ISuccessResponse<boolean>> {
    // updatePlaylist: songIndexToRemove: Remove the song at this position in the playlist. Can be used more than once.
    // Subsonic doesn't allow removing by ID easily, you have to find index?
    // Wait, Subsonic API updatePlaylist songIndexToRemove.
    // This is hard if we don't know the index.
    // Alternative: fetch playlist, find index of trackId, then remove.
    const res = await this.client.get<{ playlist: { entry: any[] } }>("getPlaylist", { id: playlistId.toString() });
    const entries = res.playlist?.entry || [];
    const index = entries.findIndex(e => e.id === trackId.toString());
    if (index !== -1) {
        await this.client.get("updatePlaylist", { playlistId: playlistId.toString(), songIndexToRemove: index });
        return this.response(true);
    }
    return this.response(false);
  }

  private mapPlaylist(p: any): Playlist {
    return {
      id: p.id,
      name: p.name,
      type: TrackType.MUSIC, // Default
      userId: 0, // Not available
      createdAt: p.created,
      updatedAt: p.changed,
      _count: {
        tracks: p.songCount || 0
      }
    } as any;
  }
}
