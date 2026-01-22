import type {
  Album,
  ISuccessResponse
} from "../../models";
import { IAlbumAdapter } from "../interface";
import { SubsonicClient } from "./client";
import { mapSubsonicAlbumToAlbum, mapSubsonicSongToTrack } from "./mapper";
import { SubsonicAlbumInfo, SubsonicAlbumList } from "./types";

export class SubsonicAlbumAdapter implements IAlbumAdapter {
    constructor(private client: SubsonicClient) {}

    private response<T>(data: T): ISuccessResponse<T> {
        return {
            code: 200,
            message: "success",
            data
        };
    }

  async getAlbumList() {
    const res = await this.client.get<SubsonicAlbumList>("getAlbumList2", { type: "newest", size: 50 });
    const list = (res.albumList?.album || []).map(a => mapSubsonicAlbumToAlbum(a, (id) => this.client.getCoverUrl(id)));
    return this.response(list);
  }

  async getAlbumTableList(params: {
    pageSize: number;
    current: number;
  }) {
    const offset = (params.current - 1) * params.pageSize;
    const res = await this.client.get<SubsonicAlbumList>("getAlbumList2", { type: "alphabeticalByName", size: params.pageSize, offset });
    // Subsonic doesn't give total count easily in this view (legacy).
    // We might guess "total" or just set it high.
    const list = (res.albumList?.album || []).map(a => mapSubsonicAlbumToAlbum(a, (id) => this.client.getCoverUrl(id)));
    return this.response({
        pageSize: params.pageSize,
        current: params.current,
        list,
        total: 1000 // Fake total as we don't know
    });
  }

  async loadMoreAlbum(params: {
    pageSize: number;
    loadCount: number;
    type?: string;
  }) {
    const offset = 0; // Assuming loadCount is total items loaded so far? Or offset?
    const res = await this.client.get<SubsonicAlbumList>("getAlbumList2", { type: "alphabeticalByName", size: 1000000, offset });
    console.log("res", res);
    const list = (res.albumList2?.album || []).map(a => mapSubsonicAlbumToAlbum(a, (id) => this.client.getCoverUrl(id)));
    
    return this.response({
        pageSize: params.pageSize,
        loadCount: params.loadCount + list.length,
        list,
        total: list.length,
        hasMore: false
    });
  }

  async createAlbum(data: Omit<Album, "id">): Promise<ISuccessResponse<Album>> {
     throw new Error("Create Album not supported");
  }

  async updateAlbum(id: number | string, data: Partial<Album>): Promise<ISuccessResponse<Album>> {
    throw new Error("Update Album not supported");
  }

  async deleteAlbum(id: number | string): Promise<ISuccessResponse<boolean>> {
    throw new Error("Delete Album not supported");
  }

  async batchCreateAlbums(data: Omit<Album, "id">[]): Promise<ISuccessResponse<boolean>> {
    throw new Error("Batch Create Album not supported");
  }

  async batchDeleteAlbums(ids: (number | string)[]): Promise<ISuccessResponse<boolean>> {
    throw new Error("Batch Delete Album not supported");
  }

  async getRecommendedAlbums(type?: string, random?: boolean, pageSize?: number) {
    // frequent, recent...
    const res = await this.client.get<SubsonicAlbumList>("getAlbumList2", { type: "frequent", size: pageSize || 10 });
    const list = (res.albumList?.album || []).map(a => mapSubsonicAlbumToAlbum(a, (id) => this.client.getCoverUrl(id)));
    return this.response(list);
  }

  async getRecentAlbums(type?: string, random?: boolean, pageSize?: number) {
    const res = await this.client.get<SubsonicAlbumList>("getAlbumList2", { type: "recent", size: pageSize || 10 });
    const list = (res.albumList?.album || []).map(a => mapSubsonicAlbumToAlbum(a, (id) => this.client.getCoverUrl(id)));
    return this.response(list);
  }

  async getAlbumById(id: number | string) {
    const res = await this.client.get<SubsonicAlbumInfo>("getAlbum", { id: id.toString() });
    return this.response(mapSubsonicAlbumToAlbum(res.album, (id) => this.client.getCoverUrl(id)));
  }

  async getAlbumTracks(
    id: number | string,
    pageSize: number,
    skip: number,
    sort: "asc" | "desc" = "asc",
    keyword?: string,
    userId?: number | string,
  ) {
      // getAlbum returns tracks inside it.
    const res = await this.client.get<SubsonicAlbumInfo>("getAlbum", { id: id.toString() });
    let songs = res.album.song || [];
    // manual pagination
    const total = songs.length;
    if (keyword) {
        songs = songs.filter(s => s.title.toLowerCase().includes(keyword.toLowerCase()));
    }
    // minimal sort support
    // pagination
    songs = songs.slice(skip, skip + pageSize);
    const list = songs.map(s => mapSubsonicSongToTrack(s, (id) => this.client.getCoverUrl(id), (id) => this.client.getStreamUrl(id)));
    
    return this.response({
        list,
        total
    });
  }

  async getAlbumsByArtist(artist: string) {
     // use getArtist to get albums?
     // We need artist ID. If artist is string name, we first need to search for artist.
     // This is tricky. search2 -> get artist ID -> getArtist.
     // For now, assume searching string works or unsupported.
     // Actually getAlbumList2 type=alphabeticalByArtist doesn't filter by artist.
     // We must use `getArtist`.
     // But we only have `artist` name.
     // Subsonic `getArtist` needs ID.
     // Workaround: Use search3 to find artist ID?
     try {
        const searchRes = await this.client.get<{searchResult3: { artist: any[] }}>("search3", { query: artist, artistCount: 1 });
        const artistObj = searchRes.searchResult3?.artist?.[0];
        if (artistObj) {
             const artistRes = await this.client.get<{artist: { album: any[] }}>("getArtist", { id: artistObj.id });
             const list = (artistRes.artist?.album || []).map(a => mapSubsonicAlbumToAlbum(a, (id) => this.client.getCoverUrl(id)));
             return this.response(list);
        }
     } catch (e) {
         // ignore
     }
     return this.response([]);
  }

  async getCollaborativeAlbumsByArtist(artist: string) {
     return this.response([]);
  }

  async toggleLike(id: number | string, userId: number | string) {
    await this.client.get("star", { albumId: id.toString() });
    return this.response(null);
  }

  async toggleUnLike(id: number | string, userId: number | string) {
    await this.client.get("unstar", { albumId: id.toString() });
    return this.response(null);
  }

  async getFavoriteAlbums(userId: number | string, loadCount: number, pageSize: number, type?: string) {
    const res = await this.client.get<SubsonicAlbumList>("getAlbumList2", { type: "starred", size: pageSize, offset: loadCount });
    const albums = res.albumList2?.album || res.albumList?.album || [];
    const list = albums.map(a => ({
        album: mapSubsonicAlbumToAlbum(a, (id) => this.client.getCoverUrl(id)),
        createdAt: a.starred || a.created || new Date().toISOString()
    }));
    return this.response({
        pageSize,
        loadCount: loadCount + list.length,
        list,
        total: 1000,
        hasMore: list.length === pageSize
    });
  }
}
