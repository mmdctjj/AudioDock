import type {
  Artist,
  ISuccessResponse
} from "../../models";
import { IArtistAdapter } from "../interface";
import { SubsonicClient } from "./client";
import { mapSubsonicArtistToArtist } from "./mapper";
import { SubsonicArtistInfo, SubsonicArtistList } from "./types";

export class SubsonicArtistAdapter implements IArtistAdapter {
    constructor(private client: SubsonicClient) {}

    private response<T>(data: T): ISuccessResponse<T> {
        return {
            code: 200,
            message: "success",
            data
        };
    }

  async getArtistList(
    pageSize: number,
    loadCount: number,
    type?: string
  ) {
    // getArtists returns indexed list.
    const res = await this.client.get<SubsonicArtistList>("getArtists");
    const allArtists: any[] = [];
    res.artists?.index?.forEach(i => {
        if(i.artist) allArtists.push(...i.artist);
    });
    // pagination
    const slice = allArtists.slice(loadCount, loadCount + pageSize);
    const list = slice.map(a => mapSubsonicArtistToArtist(a, (id) => this.client.getCoverUrl(id)));
    
    return this.response({
         pageSize,
         loadCount: loadCount + list.length,
         list,
         total: allArtists.length,
         hasMore: (loadCount + list.length) < allArtists.length
    });
  }

  async getArtistTableList(params: {
    pageSize: number;
    current: number;
  }) {
     const loadCount = (params.current - 1) * params.pageSize;
     const res = await this.client.get<SubsonicArtistList>("getArtists");
     const allArtists: any[] = [];
    res.artists?.index?.forEach(i => {
        if(i.artist) allArtists.push(...i.artist);
    });
    const slice = allArtists.slice(loadCount, loadCount + params.pageSize);
    const list = slice.map(a => mapSubsonicArtistToArtist(a, (id) => this.client.getCoverUrl(id)));

    return this.response({
        pageSize: params.pageSize,
        current: params.current,
        list,
        total: allArtists.length
    });
  }

  async loadMoreArtist(params: {
    pageSize: number;
    loadCount: number;
  }) {
      return this.getArtistList(params.pageSize, params.loadCount);
  }

  async createArtist(data: Omit<Artist, "id">): Promise<ISuccessResponse<Artist>> {
     throw new Error("Create Artist not supported");
  }

  async updateArtist(id: number | string, data: Partial<Artist>): Promise<ISuccessResponse<Artist>> {
    throw new Error("Update Artist not supported");
  }

  async deleteArtist(id: number | string): Promise<ISuccessResponse<boolean>> {
    throw new Error("Delete Artist not supported");
  }

  async batchCreateArtists(data: Omit<Artist, "id">[]): Promise<ISuccessResponse<boolean>> {
    throw new Error("Batch Create Artist not supported");
  }

  async batchDeleteArtists(ids: (number | string)[]): Promise<ISuccessResponse<boolean>> {
    throw new Error("Batch Delete Artist not supported");
  }

  async getArtistById(id: number | string) {
     const res = await this.client.get<SubsonicArtistInfo>("getArtist", { id: id.toString() });
     return this.response(mapSubsonicArtistToArtist(res.artist, (id) => this.client.getCoverUrl(id)));
  }

  async getLatestArtists(type: string, random?: boolean, pageSize?: number) {
      // Not supported directly, return random subset?
      return this.response([]); 
  }
}
