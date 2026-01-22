import { IMusicAdapter } from "../interface";
import { NativeAlbumAdapter } from "./album";
import { NativeArtistAdapter } from "./artist";
import { NativeAuthAdapter } from "./auth";
import { NativePlaylistAdapter } from "./playlist";
import { NativeTrackAdapter } from "./track";
import { NativeUserAdapter } from "./user";

export class NativeMusicAdapter implements IMusicAdapter {
  track = new NativeTrackAdapter();
  album = new NativeAlbumAdapter();
  artist = new NativeArtistAdapter();
  playlist = new NativePlaylistAdapter();
  user = new NativeUserAdapter();
  auth = new NativeAuthAdapter();
}
