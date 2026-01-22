import { Album, Artist, Track, TrackType } from "../../models";
import { SubsonicAlbum, SubsonicArtist, SubsonicChild } from "./types";

export const mapSubsonicSongToTrack = (
  song: SubsonicChild, 
  coverUrlBuilder: (id: string) => string,
  streamUrlBuilder: (id: string) => string
): Track => {
  return {
    id: song.id || 0,
    name: song.title,
    path: streamUrlBuilder(song.id),
    artist: song.artist || "Unknown Artist",
    artistEntity: {
        id: song.artistId as string,
        name: song.artist || "Unknown Artist",
        avatar: null,
        type: TrackType.MUSIC
    },
    album: song.album || "Unknown Album",
    albumEntity: {
        id: song.albumId as string,
        name: song.album || "Unknown Album",
        artist: song.artist || "Unknown Artist",
        cover: song.coverArt ? coverUrlBuilder(song.coverArt) : null,
        year: song.year?.toString() || null,
        type: TrackType.MUSIC
    },
    cover: song.coverArt ? coverUrlBuilder(song.coverArt) : null,
    duration: song.duration || 0,
    lyrics: null,
    index: song.track || null,
    type: TrackType.MUSIC,
    createdAt: song.created || new Date().toISOString(),
    artistId: parseInt(song.artistId || "0") || undefined,
    albumId: parseInt(song.albumId || "0") || undefined,
    folderId: parseInt(song.parent || "0") || undefined,
    // defaults
    likedByUsers: [],
    listenedByUsers: [],
    likedAsAudiobookByUsers: [],
    listenedAsAudiobookByUsers: [],
    playlists: [],
    progress: 0
  };
};

export const mapSubsonicAlbumToAlbum = (album: SubsonicAlbum, coverUrlBuilder: (id: string) => string): Album => {
    return {
        id: album.id,
        name: album.name,
        artist: album.artist,
        cover: album.coverArt ? coverUrlBuilder(album.coverArt) : null,
        year: album.year?.toString() || null,
        type: TrackType.MUSIC, // Defaulting to Music
        // Defaults
        likedByUsers: [],
        listenedByUsers: [],
        progress: 0,
        resumeTrackId: null,
        resumeProgress: null
    };
}

export const mapSubsonicArtistToArtist = (artist: SubsonicArtist, coverUrlBuilder: (id: string) => string): Artist => {
    return {
        id: artist.id,
        name: artist.name,
        avatar: artist.coverArt ? coverUrlBuilder(artist.coverArt) : null,
        type: TrackType.MUSIC,
        bg_cover: null,
        description: null
    };
}
