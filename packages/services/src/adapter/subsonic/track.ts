import type {
  ISuccessResponse,
  Track
} from "../../models";
import { ITrackAdapter } from "../interface";
import { SubsonicClient } from "./client";
import { mapSubsonicSongToTrack } from "./mapper";
import { SubsonicChild, SubsonicRandomSongs } from "./types";

export class SubsonicTrackAdapter implements ITrackAdapter {
  constructor(private client: SubsonicClient) {}

  private response<T>(data: T): ISuccessResponse<T> {
      return {
          code: 200,
          message: "success",
          data
      };
  }

  async getTrackList() {
    // Subsonic doesn't have a direct "get all tracks" efficiently.
    // We'll return random songs as a default list.
    const res = await this.client.get<SubsonicRandomSongs>("getRandomSongs", { size: 50 });
    const tracks = (res.randomSongs?.song || []).map(s => mapSubsonicSongToTrack(s, (id) => this.client.getCoverUrl(id), (id) => this.client.getStreamUrl(id)));
    return this.response(tracks);
  }

  async getTrackTableList(params: {
    pageSize: number;
    current: number;
  }) {
    // Use search as a proxy for list, or random if search not viable for "all".
    // Subsonic 1.8.0+ has search3.
    // Using empty query might not return all.
    // Fallback: Random for now, or just empty list if we can't iterate all.
    // Better: getStarred?
    // Let's assume we can't easily pagination ALL tracks in Subsonic without traversing everything.
    // We returns a empty list or random.
    return this.response({
        pageSize: params.pageSize,
        current: params.current,
        list: [],
        total: 0
    });
  }

  async loadMoreTrack(params: {
    pageSize: number;
    loadCount: number;
  }) {
     // Similar limitation.
     return this.response({
         pageSize: params.pageSize,
         loadCount: params.loadCount,
         list: [],
         total: 0,
         hasMore: false
     });
  }

  async createTrack(data: Omit<Track, "id">): Promise<ISuccessResponse<Track>> {
    throw new Error("Creation not supported in Subsonic Adapter");
  }

  async updateTrack(id: number | string, data: Partial<Track>): Promise<ISuccessResponse<Track>> {
     // Subsonic supports star/unstar, but editing metadata is limited.
     // star: star.view?id=...
     throw new Error("Update not supported fully in Subsonic Adapter");
  }

  async deleteTrack(id: number | string, deleteAlbum: boolean = false): Promise<ISuccessResponse<boolean>> {
     throw new Error("Delete not supported in Subsonic Adapter");
  }

  async getDeletionImpact(id: number | string) {
     return this.response({ isLastTrackInAlbum: false, albumName: null });
  }

  async batchCreateTracks(data: Omit<Track, "id">[]): Promise<ISuccessResponse<boolean>> {
     throw new Error("Batch create not supported");
  }

  async batchDeleteTracks(ids: (number | string)[]): Promise<ISuccessResponse<boolean>> {
     throw new Error("Batch delete not supported");
  }

  async getLatestTracks(type?: string, random?: boolean, pageSize?: number) {
      // type is often "music" or "audiobook".
      const res = await this.client.get<SubsonicRandomSongs>("getRandomSongs", { size: pageSize || 20 });
      const tracks = (res.randomSongs?.song || []).map(s => mapSubsonicSongToTrack(s, (id) => this.client.getCoverUrl(id), (id) => this.client.getStreamUrl(id)));
      return this.response(tracks);
  }

  async getTracksByArtist(artist: string) {
    // search3
    const res = await this.client.get<{searchResult3: { song: SubsonicChild[] }}>("search3", { query: artist, songCount: 50 });
    const tracks = (res.searchResult3?.song || []).map(s => mapSubsonicSongToTrack(s, (id) => this.client.getCoverUrl(id), (id) => this.client.getStreamUrl(id)));
    return this.response(tracks);
  }

  async toggleLike(id: number | string, userId: number | string) {
    await this.client.get("star", { id: id.toString() });
    return this.response(null);
  }

  async toggleUnLike(id: number | string, userId: number | string) {
    await this.client.get("unstar", { id: id.toString() });
    return this.response(null);
  }

  async getFavoriteTracks(userId: number | string, loadCount: number, pageSize: number, type?: string) {
    const res = await this.client.get<{ starred: { song: SubsonicChild[] } }>("getStarred");
    const tracks = (res.starred?.song || [])
      .slice(loadCount, loadCount + pageSize)
      .map(s => ({
        track: mapSubsonicSongToTrack(s, (id) => this.client.getCoverUrl(id), (id) => this.client.getStreamUrl(id)),
        createdAt: s.starred || s.created || new Date().toISOString()
      }));
    
    return this.response({
        pageSize,
        loadCount: loadCount + tracks.length,
        list: tracks,
        total: res.starred?.song?.length || 0,
        hasMore: loadCount + tracks.length < (res.starred?.song?.length || 0)
    });
  }

  async getLyrics(id: number | string) {
    const res = await this.client.get<{ song: SubsonicChild }>("getSong", { id: id.toString() });
    const song = res.song;
    if (!song) return this.response(null);
    
    // Subsonic getLyrics typically uses artist and title.
    const lyricsRes = await this.client.get<{ lyrics: any }>("getLyrics", {
      artist: song.artist,
      title: song.title
    });
    
    // Subsonic JSON format for lyrics can vary: { lyrics: { value: "..." } } or { lyrics: { "$": "..." } }
    const lyricsData = lyricsRes.lyrics;
    const lyrics = lyricsData?.value || lyricsData?.["$"] || (typeof lyricsData === 'string' ? lyricsData : null);
    
    return this.response(lyrics);
  }
}
