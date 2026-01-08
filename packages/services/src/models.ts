export interface ISuccessResponse<T> {
  code: number;
  message: string;
  data: T;
}

export enum TrackType {
  MUSIC = "MUSIC",
  AUDIOBOOK = "AUDIOBOOK",
}

export interface IErrorResponse {
  code: number;
  message: string;
}

export interface ITableData<T> {
  pageSize: number;
  current: number;
  list: T;
  total: number;
}

export interface ILoadMoreData<T> {
  pageSize: number;
  loadCount: number;
  list: T[];
  total: number;
  hasMore: boolean;
}

export interface RecommendedItem {
  title: string
  id: string
  items: Album[]
}

export interface TimelineItem {
  id: string
  time: number
  items: (Album | Track)[]
}

// Prisma Models

export interface Track {
  id: number;
  name: string;
  path: string;
  artist: string;
  artistEntity: Artist;
  album: string;
  albumEntity: Album;
  cover: string | null;
  duration: number | null;
  lyrics: string | null;
  index: number | null;
  type: TrackType;
  createdAt: string | Date; // DateTime in Prisma maps to Date object or ISO string in JSON
  artistId?: number;
  albumId?: number;
  folderId?: number;
  likedByUsers?: UserTrackLike[];
  listenedByUsers?: UserTrackHistory[];
  likedAsAudiobookByUsers?: UserAudiobookLike[];
  listenedAsAudiobookByUsers?: UserAudiobookHistory[];
  playlists?: Playlist[];
  progress?: number;
}

export interface Album {
  id: number;
  name: string;
  artist: string;
  cover: string | null;
  year: string | null;
  type: TrackType;
  likedByUsers?: UserAlbumLike[];
  listenedByUsers?: UserAlbumHistory[];
  progress?: number;
  resumeTrackId?: number | null;
  resumeProgress?: number | null;
}

export interface Artist {
  id: number;
  name: string;
  avatar: string | null;
  type: TrackType;
  bg_cover?: string | null;
  description?: string | null;
}

export interface UserTrackLike {
  id: number;
  userId: number;
  trackId: number;
  createdAt: string | Date;
  user?: User;
  track?: Track;
}

export interface UserTrackHistory {
  id: number;
  userId: number;
  trackId: number;
  listenedAt: string | Date;
  user?: User;
  track?: Track;
}

export interface UserAlbumLike {
  id: number;
  userId: number;
  albumId: number;
  createdAt: string | Date;
  user?: User;
  album?: Album;
}

export interface UserAlbumHistory {
  id: number;
  userId: number;
  albumId: number;
  listenedAt: string | Date;
  user?: User;
  album?: Album;
}

export interface UserAudiobookLike {
  id: number;
  userId: number;
  trackId: number;
  createdAt: string | Date;
  user?: User;
  track?: Track;
}

export interface UserAudiobookHistory {
  id: number;
  userId: number;
  trackId: number;
  listenedAt: string | Date;
  progress: number;
  user?: User;
  track?: Track;
}

export interface User {
  id: number;
  username: string;
  password?: string;
  is_admin: boolean;
  likedTracks?: UserTrackLike[];
  listenedTracks?: UserTrackHistory[];
  likedAlbums?: UserAlbumLike[];
  listenedAlbums?: UserAlbumHistory[];
  likedAudiobooks?: UserAudiobookLike[];
  listenedAudiobooks?: UserAudiobookHistory[];
  playlists?: Playlist[];
}

export interface Playlist {
  id: number;
  name: string;
  type: TrackType;
  createdAt: string | Date;
  updatedAt: string | Date;
  userId: number;
  user?: User;
  tracks?: Track[];
  _count?: {
    tracks: number;
  };
}
export interface Device {
  id: number;
  name: string;
  userId: number;
  isOnline: boolean;
  lastSeen?: string | Date;
  createdAt: Date;
  updatedAt: Date;
}
export interface Folder {
  id: number;
  path: string;
  name: string;
  parentId: number | null;
  type: TrackType;
  children?: Folder[];
  tracks?: Track[];
}
