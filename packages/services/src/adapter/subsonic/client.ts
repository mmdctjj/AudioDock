import axios, { AxiosInstance } from "axios";
import md5 from "js-md5";
import { getServiceConfig } from "../../config";
import { getBaseURL } from "../../request";

export interface SubsonicConfig {
    baseUrl?: string;
    username?: string;
    password?: string;
    clientName?: string;
}

export interface SubsonicResponse<T> {
  "subsonic-response": {
    status: "ok" | "failed";
    version: string;
    error?: {
      code: number;
      message: string;
    };
  } & T;
}

export class SubsonicClient {
    private axios: AxiosInstance;

    constructor(config?: SubsonicConfig) {
        this.axios = axios.create({
            timeout: 30000,
        });
    }

    private getAuthParams() {
        const config = getServiceConfig();
        const username = config.username;
        const password = config.password || "";
        const clientName = config.clientName || "SoundX";

        if (!username) {
            return { c: clientName, v: "1.16.1", f: "json" };
        }

        const salt = Math.random().toString(36).substring(2, 15);
        const token = (md5 as any)(password + salt);

        return {
            u: username,
            t: token,
            s: salt,
            v: "1.16.1", // Compatible version
            c: clientName,
            f: "json"
        };
    }

    private getBaseUrl(): string {
        return getBaseURL();
    }

    private buildUrl(base: string, endpoint: string): string {
         const cleanBase = base.replace(/\/+$/, '');
         const cleanEndpoint = endpoint.replace(/^\/+/, '').replace(/\.view$/, '');
         return `${cleanBase}/rest/${cleanEndpoint}.view`;
    }

    public getCoverUrl(id: string | number, size?: number) {
         const auth = this.getAuthParams() as any;
         const query = new URLSearchParams(auth);
         query.append("id", id.toString());
         if (size) query.append("size", size.toString());
         return `${this.buildUrl(this.getBaseUrl(), "getCoverArt")}?${query.toString()}`;
    }

    public getStreamUrl(id: string | number) {
         const auth = this.getAuthParams() as any;
         const query = new URLSearchParams(auth);
         query.append("id", id.toString());
         return `${this.buildUrl(this.getBaseUrl(), "stream")}?${query.toString()}`;
    }

    public async get<T>(endpoint: string, params: any = {}): Promise<T> {
        const authParams = this.getAuthParams();
        const baseURL = this.getBaseUrl();
        if (!baseURL) throw new Error("Base URL not set");

        const response = await this.axios.get<SubsonicResponse<T>>(this.buildUrl(baseURL, endpoint), {
            params: {
                ...authParams,
                ...params
            }
        });
        
        const data = response.data?.["subsonic-response"];
        if (data && data.status === "failed") {
            throw new Error(data.error?.message || "Subsonic Request Failed");
        }
        return data as T;
    }
    
    public async post<T>(endpoint: string, params: any = {}, body: any = {}): Promise<T> {
        const authParams = this.getAuthParams();
        const baseURL = this.getBaseUrl();
        if (!baseURL) throw new Error("Base URL not set");

        const response = await this.axios.post<SubsonicResponse<T>>(this.buildUrl(baseURL, endpoint), body, {
            params: {
                ...authParams,
                ...params
            }
        });
        const data = response.data?.["subsonic-response"];
        if (data && data.status === "failed") {
            throw new Error(data.error?.message || "Subsonic Request Failed");
        }
        return data as T;
    }
}
