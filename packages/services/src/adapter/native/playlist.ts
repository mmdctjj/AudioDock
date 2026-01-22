import { ISuccessResponse, Playlist } from "../../models";
import request from "../../request";
import { IPlaylistAdapter } from "../interface";

export class NativePlaylistAdapter implements IPlaylistAdapter {
  async createPlaylist(name: string, type: "MUSIC" | "AUDIOBOOK", userId: number | string): Promise<ISuccessResponse<Playlist>> {
    return await request.post<any, ISuccessResponse<Playlist>>("/playlists", { name, type, userId });
  }

  async getPlaylists(type?: "MUSIC" | "AUDIOBOOK", userId?: number | string): Promise<ISuccessResponse<Playlist[]>> {
    return await request.get<any, ISuccessResponse<Playlist[]>>("/playlists", { params: { userId, type } });
  }

  async getPlaylistById(id: number | string): Promise<ISuccessResponse<Playlist>> {
    return await request.get<any, ISuccessResponse<Playlist>>(`/playlists/${id}`);
  }

  async updatePlaylist(id: number | string, name: string): Promise<ISuccessResponse<Playlist>> {
    return await request.put<any, ISuccessResponse<Playlist>>(`/playlists/${id}`, { name });
  }

  async deletePlaylist(id: number | string): Promise<ISuccessResponse<boolean>> {
    return await request.delete<any, ISuccessResponse<boolean>>(`/playlists/${id}`);
  }

  async addTrackToPlaylist(playlistId: number | string, trackId: number | string): Promise<ISuccessResponse<boolean>> {
    return await request.post<any, ISuccessResponse<boolean>>(`/playlists/${playlistId}/tracks`, { trackId });
  }

  async addTracksToPlaylist(playlistId: number | string, trackIds: (number | string)[]): Promise<ISuccessResponse<boolean>> {
    return await request.post<any, ISuccessResponse<boolean>>(`/playlists/${playlistId}/tracks/batch`, { trackIds });
  }

  async removeTrackFromPlaylist(playlistId: number | string, trackId: number | string): Promise<ISuccessResponse<boolean>> {
    return await request.delete<any, ISuccessResponse<boolean>>(`/playlists/${playlistId}/tracks/${trackId}`);
  }
}
