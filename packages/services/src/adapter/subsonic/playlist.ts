import { ISuccessResponse, Playlist, TrackType } from "../../models";
import { IPlaylistAdapter } from "../interface";
import { SubsonicClient } from "./client";
import { mapSubsonicSongToTrack } from "./mapper";

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
    return this.response(list);
  }

  async getPlaylistById(id: number | string): Promise<ISuccessResponse<Playlist>> {
    const res = await this.client.get<{ playlist: any }>("getPlaylist", { id: id.toString() });
    return this.response(this.mapPlaylist(res.playlist));
  }

  async updatePlaylist(id: number | string, name: string): Promise<ISuccessResponse<Playlist>> {
    await this.client.get("updatePlaylist", { playlistId: id.toString(), name });
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
    for (const tid of trackIds) {
        await this.addTrackToPlaylist(playlistId, tid);
    }
    return this.response(true);
  }

  async removeTrackFromPlaylist(playlistId: number | string, trackId: number | string): Promise<ISuccessResponse<boolean>> {
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
    const tracks = (p.entry || []).map((s: any) => mapSubsonicSongToTrack(s, (id) => this.client.getCoverUrl(id), (id) => this.client.getStreamUrl(id)));
    
    return {
      id: p.id,
      name: p.name,
      type: TrackType.MUSIC, 
      userId: 0, 
      createdAt: p.created,
      updatedAt: p.changed,
      tracks: tracks,
      _count: {
        tracks: p.songCount || tracks.length || 0
      }
    } as any;
  }
}
