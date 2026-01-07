import { Injectable } from '@nestjs/common';
import { PrismaClient, Track, TrackType } from '@soundx/db';

@Injectable()
export class AudiobookService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async getAudiobookList(): Promise<Track[]> {
    return await this.prisma.track.findMany({
      where: { type: TrackType.AUDIOBOOK },
    });
  }

  async getAudiobookTableList(
    pageSize: number,
    current: number,
  ): Promise<Track[]> {
    return await this.prisma.track.findMany({
      where: { type: TrackType.AUDIOBOOK },
      skip: (current - 1) * pageSize,
      take: pageSize,
      orderBy: { id: 'desc' },
    });
  }

  async loadMoreAudiobook(
    pageSize: number,
    loadCount: number,
  ): Promise<Track[]> {
    return await this.prisma.track.findMany({
      where: { type: TrackType.AUDIOBOOK },
      skip: loadCount * pageSize,
      take: pageSize,
      orderBy: { id: 'desc' },
    });
  }

  async getLatestAudiobooks(limit = 8): Promise<Track[]> {
    return await this.prisma.track.findMany({
      where: { type: TrackType.AUDIOBOOK },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async audiobookCount(): Promise<number> {
    return await this.prisma.track.count({
      where: { type: TrackType.AUDIOBOOK },
    });
  }

  async createAudiobook(track: Omit<Track, 'id'>): Promise<Track> {
    return await this.prisma.track.create({
      data: { ...track, type: TrackType.AUDIOBOOK },
    });
  }

  async updateAudiobook(id: number, track: Partial<Track>): Promise<Track> {
    return await this.prisma.track.update({
      where: { id },
      data: { ...track, type: TrackType.AUDIOBOOK },
    });
  }

  async deleteAudiobook(id: number): Promise<boolean> {
    await this.prisma.track.delete({
      where: { id },
    });
    return true;
  }

  async createAudiobooks(tracks: Omit<Track, 'id'>[]): Promise<boolean> {
    const res = await this.prisma.track.createMany({
      data: tracks.map((t) => ({ ...t, type: TrackType.AUDIOBOOK })),
    });
    if (res.count !== tracks.length) {
      throw new Error('批量新增失败');
    }
    return true;
  }

  async deleteAudiobooks(ids: number[]): Promise<boolean> {
    await this.prisma.track.deleteMany({
      where: { id: { in: ids }, type: TrackType.AUDIOBOOK },
    });
    return true;
  }

  // 随机推荐：用户未听过的有声书“专辑”（按 Track.album 聚合）
  async getRandomUnlistenedAudiobookAlbums(
    userId: number,
    limit: number = 8,
  ): Promise<Track[]> {
    // 用户听过的有声书所属专辑名集合
    const listened = await this.prisma.userAudiobookHistory.findMany({
      where: { userId },
      include: { track: { select: { album: true, type: true } } },
    });
    const listenedAlbumNames = new Set(
      listened
        .filter((h) => h.track?.type === TrackType.AUDIOBOOK)
        .map((h) => h.track?.album)
        .filter(Boolean),
    );

    // 所有有声书专辑名（去重）
    const allAlbumNameRows = await this.prisma.track.findMany({
      where: { type: TrackType.AUDIOBOOK },
      select: { album: true },
    });
    const allAlbumNames = Array.from(
      new Set(allAlbumNameRows.map((r) => r.album).filter(Boolean)),
    );

    // 未听过的专辑名，随机取前 limit
    const unlistenedAlbumNames = allAlbumNames.filter(
      (name) => !listenedAlbumNames.has(name),
    );
    const shuffled = unlistenedAlbumNames.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, limit);

    // 为每个专辑名取一个代表 Track（最新）
    const result: Track[] = [];
    for (const name of picked) {
      const t = await this.prisma.track.findFirst({
        where: { type: TrackType.AUDIOBOOK, album: name },
        orderBy: { createdAt: 'desc' },
      });
      if (t) result.push(t);
    }
    return result;
  }
}
