import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, TrackType } from '@soundx/db'; // Import PrismaClient
import { LocalMusicScanner } from '@soundx/utils';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { LogMethod } from '../common/log-method.decorator';
import { AlbumService } from './album';
import { ArtistService } from './artist';
import { TrackService } from './track';

export enum TaskStatus {
  INITIALIZING = 'INITIALIZING',
  PARSING = 'PARSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface ImportTask {
  id: string;
  status: TaskStatus;
  message?: string;
  total?: number;
  current?: number;
  mode?: 'incremental' | 'full';
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private tasks: Map<string, ImportTask> = new Map();
  private prisma: PrismaClient;

  constructor(
    private readonly trackService: TrackService,
    private readonly albumService: AlbumService,
    private readonly artistService: ArtistService,
  ) {
    this.prisma = new PrismaClient();
  }

  @LogMethod()
  createTask(musicPath: string, audiobookPath: string, cachePath: string, mode: 'incremental' | 'full' = 'incremental'): string {
    const id = randomUUID();
    this.tasks.set(id, { id, status: TaskStatus.INITIALIZING, mode });

    this.startImport(id, musicPath, audiobookPath, cachePath, mode).catch(err => {
      console.error("Unhandled import error", err);
    });

    return id;
  }

  @LogMethod()
  getTask(id: string): ImportTask | undefined {
    return this.tasks.get(id);
  }

  private convertToHttpUrl(localPath: string, type: 'cover' | 'audio' | 'music', basePath: string): string {
    // Calculate relative path from base directory to preserve folder structure
    const relativePath = path.relative(basePath, localPath);

    if (type === 'cover') {
      // For covers, just use filename (existing behavior)
      const filename = path.basename(localPath);
      return `/covers/${filename}`;
    } else {
      // For audio, preserve the relative path structure
      return `/${type}/${relativePath}`;
    }
  }

  private async clearLibraryData() {
    this.logger.log('Starting full library cleanup...');

    // 1. Clear User Relations (dependent on Tracks/Albums)
    await this.prisma.userTrackHistory.deleteMany();
    await this.prisma.userTrackLike.deleteMany();
    await this.prisma.userAudiobookHistory.deleteMany();
    await this.prisma.userAudiobookLike.deleteMany();
    await this.prisma.userAlbumHistory.deleteMany();
    await this.prisma.userAlbumLike.deleteMany();

    // 2. Clear Playlists (dependent on Users and Tracks, but we delete only playlists for now)
    // Note: Implicit m-n relation table `_PlaylistToTrack` is cleaned up automatically by Prisma cascades usually,
    // but explicit `Playlist` records need deletion.
    await this.prisma.playlist.deleteMany();

    // 3. Clear Core Data
    await this.prisma.track.deleteMany();
    await this.prisma.album.deleteMany();
    await this.prisma.artist.deleteMany();
    await this.prisma.folder.deleteMany();

    this.logger.log('Full library cleanup completed.');
  }

  private async startImport(id: string, musicPath: string, audiobookPath: string, cachePath: string, mode: 'incremental' | 'full') {
    const task = this.tasks.get(id);
    if (!task) return;

    try {
      console.log("startImport", id, musicPath, audiobookPath, cachePath, mode);

      if (mode === 'full') {
        await this.clearLibraryData();
      }

      const scanner = new LocalMusicScanner(cachePath);
      // ... (rest of scanner initialization)

      task.status = TaskStatus.PARSING;

      // Scan Music
      const musicResults = await scanner.scanMusic(musicPath);
      // Scan Audiobooks
      const audiobookResults = await scanner.scanAudiobook(audiobookPath);

      task.total = musicResults.length + audiobookResults.length;
      task.current = 0;

      // Cache for folder IDs to reduce DB queries
      const folderCache = new Map<string, number>();

      const getFolderId = async (localPath: string, basePath: string, type: TrackType): Promise<number | null> => {
        const dirPath = path.dirname(localPath);
        const cacheKey = `${dirPath}`;
        
        if (folderCache.has(cacheKey)) {
          return folderCache.get(cacheKey)!;
        }

        const folderId = await this.getOrCreateFolderHierarchically(dirPath, basePath, type);
        if (folderId) {
          folderCache.set(cacheKey, folderId);
        }
        return folderId;
      };

      const processItem = async (item: any, type: TrackType, audioBasePath: string, index: number) => {
        const artistName = item.artist || '未知';
        const albumName = item.album || '未知';

        // Convert local cover path to HTTP URL
        const coverUrl = item.coverPath ? this.convertToHttpUrl(item.coverPath, 'cover', cachePath) : null;


        // Convert local audio path to HTTP URL, preserving relative path from base directory
        const audioUrl = this.convertToHttpUrl(item.path, type === TrackType.AUDIOBOOK ? 'audio' : 'music', audioBasePath);

        // Track ID to collect for playlist
        let trackId: number;

         // Handle Folder (Compute this first as it's needed for both new and existing tracks)
         const folderId = await getFolderId(item.path, audioBasePath, type);

        // CHECK EXISTENCE (Incremental Mode Logic)
        const existingTrack = await this.trackService.findByPath(audioUrl);
        if (existingTrack) {
          // If track exists, stick with its ID
          trackId = existingTrack.id;

          // Check if folderId needs update
          if (existingTrack.folderId !== folderId && folderId) {
             await this.trackService.updateTrack(existingTrack.id, { folderId });
          }
           
        } else {
          // 1. Handle Artist
          let artist = await this.artistService.findByName(artistName, type);
          if (!artist) {
            // Use album cover as fallback for artist avatar if not provided
            // Since we don't have artist specific avatar in import, we use coverUrl (which is album cover)
            artist = await this.artistService.createArtist({
              name: artistName,
              avatar: coverUrl,
              type: type
            });
          }

          // 2. Handle Album
          let album = await this.albumService.findByName(albumName, artistName, type);
          if (!album) {
            album = await this.albumService.createAlbum({
              name: albumName,
              artist: artistName,
              cover: coverUrl,
              year: item.year ? String(item.year) : null,
              type: type
            });
          }

          // 3. Handle Folder (Already computed above)
          // const folderId = await this.getOrCreateFolderHierarchically(path.dirname(item.path), audioBasePath, type);

          // 4. Create Track
          const newTrack = await this.trackService.createTrack({
            name: item.title || path.basename(item.path),
            artist: artistName,
            album: albumName,
            cover: coverUrl,
            path: audioUrl,
            duration: Math.round(item.duration || 0),
            lyrics: item.lyrics || null,
            index: index + 1 || 1, // Track number/index from metadata
            type: type,
            createdAt: new Date(),
            fileModifiedAt: item?.mtime ? new Date(item.mtime) : null,
            episodeNumber: extractEpisodeNumber(item.title || ""),
            artistId: artist.id,
            albumId: album.id,
            folderId: folderId,
          });
          trackId = newTrack.id;
        }


        task.current = (task.current || 0) + 1;
      };

      // Save Music (sequential to avoid duplicate creation)
      for (const [index, item] of musicResults.entries()) {
        console.log("music", item);
        await processItem(item || {}, TrackType.MUSIC, musicPath, index);
      }

      // Save Audiobooks (sequential to avoid duplicate creation)
      for (const [index, item] of audiobookResults.entries()) {
        console.log("audiobook", item);
        await processItem(item || {}, TrackType.AUDIOBOOK, audiobookPath, index);
      }


      task.status = TaskStatus.SUCCESS;
    } catch (error) {
      console.error('Import failed:', error);
      task.status = TaskStatus.FAILED;
      task.message = error instanceof Error ? error.message : String(error);
    }
  }

  private async getOrCreateFolderHierarchically(localPath: string, basePath: string, type: TrackType): Promise<number | null> {
    const relativePath = path.relative(basePath, localPath);
    if (relativePath === '' || relativePath === '.') return null;

    const parts = relativePath.split(path.sep);
    let parentId: number | null = null;
    let currentPath = basePath;

    for (const part of parts) {
      currentPath = path.join(currentPath, part);
      const folderRecord = await this.prisma.folder.upsert({
        where: { path: currentPath },
        update: {},
        create: {
          path: currentPath,
          name: part,
          parentId: parentId,
          type: type,
        },
      });
      parentId = folderRecord.id;
    }

    return parentId;
  }
}



// 将中文数字转为阿拉伯数字
function chineseToNumber(chinese: string): number {
  const map: Record<string, number> = {
    "零": 0, "〇": 0,
    "一": 1, "二": 2, "两": 2, "三": 3, "四": 4,
    "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
    "十": 10, "百": 100, "千": 1000, "万": 10000,
  };

  let num = 0;
  let unit = 1;
  let lastUnit = 1;

  for (let i = chinese.length - 1; i >= 0; i--) {
    const char = chinese[i];
    const value = map[char];

    if (value === undefined) continue;

    if (value >= 10) {
      if (value > lastUnit) {
        lastUnit = value;
        unit = value;
      } else {
        unit = unit * value;
      }
    } else {
      num += value * unit;
    }
  }
  return num || 0;
}

export function extractEpisodeNumber(title: string): number {
  // 1. 优先匹配阿拉伯数字（如：1集、第12章、13）
  let match = title.match(/(\d{1,4})\s*(集|章|节|话)?/);
  if (match) {
    return Number(match[1]);
  }

  // 2. 匹配中文数字（如：第一集、第二十章、第五十五话）
  match = title.match(/第?([零〇一二三四五六七八九十百千万两]{1,})[集章节话]?/);
  if (match) {
    return chineseToNumber(match[1]);
  }

  return 0;
}