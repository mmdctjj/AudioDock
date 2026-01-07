import { Injectable } from '@nestjs/common';
import { Album, PrismaClient, TrackType } from '@soundx/db';

@Injectable()
export class AlbumService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async getAlbumList(): Promise<Album[]> {
    return await this.prisma.album.findMany();
  }

  async findByName(name: string, artist?: string, type?: any): Promise<Album | null> {
    // Build where clause dynamically to avoid null matching issues
    const where: any = {};

    if (name !== null && name !== undefined) {
      where.name = name;
    }
    if (artist !== null && artist !== undefined) {
      where.artist = artist;
    }
    if (type !== null && type !== undefined) {
      where.type = type;
    }

    return await this.prisma.album.findFirst({ where });
  }

  async getAlbumsByArtist(artist: string): Promise<Album[]> {
    return await this.prisma.album.findMany({ where: { artist } });
  }

  async getAlbumById(id: number, userId?: number): Promise<Album | null> {
    const album = await this.prisma.album.findUnique({ where: { id }, include: { likedByUsers: true, listenedByUsers: true } });
    if (!album) return null;

    if (album.type === 'AUDIOBOOK' && userId) {
      const [enriched] = await this.attachProgressToAlbums([album], userId);
      return enriched;
    }
    return album;
  }

  async getAlbumTableList(pageSize: number, current: number): Promise<Album[]> {
    return await this.prisma.album.findMany({
      skip: (current - 1) * pageSize,
      take: pageSize,
    });
  }

  async loadMoreAlbum(pageSize: number, loadCount: number, type: TrackType, userId: number): Promise<Album[]> {
    const result = await this.prisma.album.findMany({
      skip: loadCount * pageSize,
      take: pageSize,
      where: { type },
    });

    if (type === 'AUDIOBOOK') {
      return await this.attachProgressToAlbums(result, userId); // Default userId 1
    }

    return result;
  }

  async albumCount(type?: TrackType): Promise<number> {
    return await this.prisma.album.count({ where: { type } });
  }

  async createAlbum(album: Omit<Album, 'id'>): Promise<Album> {
    return await this.prisma.album.create({
      data: album,
    });
  }

  async updateAlbum(id: number, album: Partial<Album>): Promise<Album> {
    return await this.prisma.album.update({
      where: { id },
      data: album,
    });
  }

  async deleteAlbum(id: number): Promise<boolean> {
    await this.prisma.album.delete({
      where: { id },
    });
    return true;
  }

  // 批量新增
  async createAlbums(albums: Omit<Album, 'id'>[]): Promise<boolean> {
    const albumList = await this.prisma.album.createMany({
      data: albums,
    });
    if (albumList.count !== albums.length) {
      throw new Error('批量新增失败');
    }
    return albumList.count === albums.length;
  }

  // 批量删除
  async deleteAlbums(ids: number[]): Promise<boolean> {
    await this.prisma.album.deleteMany({
      where: { id: { in: ids } },
    });
    return true;
  }

  // 新增：最近专辑（按 id 倒序）
  async getLatestAlbums(limit = 8, type: TrackType, userId: number): Promise<Album[]> {
    const result = await this.prisma.album.findMany({
      where: type ? { type } : undefined,
      orderBy: { id: 'desc' },
      take: limit,
    });

    if (type === 'AUDIOBOOK') {
      return await this.attachProgressToAlbums(result, userId); // Default userId 1
    }

    return result;
  }

  // 新增：获取随机专辑
  async getRandomAlbums(limit = 8, type: TrackType, userId: number): Promise<Album[]> {
    const count = await this.prisma.album.count({
      where: type ? { type } : undefined,
    });
    const skip = Math.max(0, Math.floor(Math.random() * (count - limit)));
    const result = await this.prisma.album.findMany({
      where: type ? { type } : undefined,
      skip,
      take: limit,
    });

    // Shuffle result to be even more random within the window
    const shuffled = result.sort(() => Math.random() - 0.5);

    if (type === 'AUDIOBOOK') {
      return await this.attachProgressToAlbums(shuffled, userId); // Default userId 1
    }

    return shuffled;
  }

  // 随机推荐：用户未听过的专辑
  async getRandomUnlistenedAlbums(userId: number, limit = 8, type?: TrackType): Promise<Album[]> {
    const listened = await this.prisma.userAlbumHistory.findMany({
      where: { userId },
      select: { albumId: true },
    });
    const listenedIds = listened.map((r) => r.albumId);

    const whereClause: any = listenedIds.length ? { id: { notIn: listenedIds } } : {};
    if (type) {
      whereClause.type = type;
    }

    const candidates = await this.prisma.album.findMany({
      where: whereClause,
    });

    if (candidates.length <= limit) return candidates;

    const shuffled = candidates.sort(() => Math.random() - 0.5);
    const result = shuffled.slice(0, limit);

    if (type === 'AUDIOBOOK') {
      return await this.attachProgressToAlbums(result, userId);
    }

    return result;
  }

  // 搜索专辑
  async searchAlbums(keyword: string, type: any, limit: number = 10, userId: number): Promise<Album[]> {
    const where: any = {
      OR: [
        { name: { contains: keyword } },
        { artist: { contains: keyword } },
      ],
    };

    if (type) {
      where.type = type;
    }

    const albums = await this.prisma.album.findMany({
      where,
      take: limit,
      orderBy: { id: 'desc' },
    });

    if (type === 'AUDIOBOOK') {
      return await this.attachProgressToAlbums(albums, userId); // Default userId 1
    }
    return albums;
  }

  // Helper: Attach progress to audiobook albums
  private async attachProgressToAlbums(albums: Album[], userId: number): Promise<Album[]> {
    if (albums.length === 0) return albums;

    const albumNames = albums.map(a => a.name);
    const artists = albums.map(a => a.artist);

    // 1. Fetch all tracks for these albums to calculate total duration
    const tracks = await this.prisma.track.findMany({
      where: {
        album: { in: albumNames },
        artist: { in: artists },
        type: 'AUDIOBOOK',
      },
      select: {
        id: true,
        album: true,
        artist: true,
        duration: true,
      },
    });

    // 2. Fetch user's listening history for these tracks
    const trackIds = tracks.map(t => t.id);
    const history = await this.prisma.userAudiobookHistory.findMany({
      where: {
        userId,
        trackId: { in: trackIds },
      },
      select: {
        trackId: true,
        progress: true,
        listenedAt: true,
      },
      orderBy: {
        listenedAt: 'desc',
      },
    });

    // Create a map for quick lookup of track progress
    const historyMap = new Map(history.map(h => [h.trackId, h.progress]));

    const listenedTrackIds = new Set(history.map(h => h.trackId));

    // 3. Calculate progress per album and find resume point
    return albums.map(album => {
      const albumTracks = tracks.filter(t => t.album === album.name && t.artist === album.artist);
      if (albumTracks.length === 0) return { ...album, progress: 0 };

      const totalDuration = albumTracks.reduce((sum, t) => sum + (t.duration || 0), 0);

      const listenedDuration = albumTracks.reduce((sum, t) => {
        const progress = historyMap.get(t.id) || 0;
        // Cap progress at track duration to avoid anomalies (e.g. if duration metadata is wrong or progress overshot)
        // But if duration is 0, progress might be valid.
        // Let's just trust progress, but maybe cap if duration exists and is > 0
        const trackDuration = t.duration || 0;
        const effectiveProgress = trackDuration > 0 ? Math.min(progress, trackDuration) : progress;
        return sum + effectiveProgress;
      }, 0);

      const progressPercent = totalDuration === 0 ? 0 : Math.min(100, Math.round((listenedDuration / totalDuration) * 100));

      // Find resume point (latest history entry for any track in this album)
      const albumTrackIds = new Set(albumTracks.map(t => t.id));
      const latestHistory = history.find(h => albumTrackIds.has(h.trackId)); // Since history is ordered by listenedAt desc

      return {
        ...album,
        progress: progressPercent,
        resumeTrackId: latestHistory ? latestHistory.trackId : null,
        resumeProgress: latestHistory ? latestHistory.progress : 0
      };
    });
  }
}
