import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Req,
} from '@nestjs/common';
import { Track } from '@soundx/db';
import { Request } from 'express';
import {
    IErrorResponse,
    ILoadMoreData,
    ISuccessResponse,
    ITableData,
} from 'src/common/const';
import { AudiobookService } from '../services/audiobook';

@Controller('/audiobook')
export class AudiobookController {
  constructor(private readonly audiobookService: AudiobookService) { }

  @Get('/list')
  async getAudiobookList(): Promise<
    ISuccessResponse<Track[]> | IErrorResponse
  > {
    try {
      const list = await this.audiobookService.getAudiobookList();
      return { code: 200, message: 'success', data: list };
    } catch (error) {
      return { code: 500, message: String(error) };
    }
  }

  @Get('/table-list')
  async getAudiobookTableList(
    @Param('pageSize') pageSize: number,
    @Param('current') current: number,
  ): Promise<ISuccessResponse<ITableData<Track[]>> | IErrorResponse> {
    try {
      const list = await this.audiobookService.getAudiobookTableList(
        pageSize,
        current,
      );
      const total = await this.audiobookService.audiobookCount();
      return {
        code: 200,
        message: 'success',
        data: { pageSize, current, list, total },
      };
    } catch (error) {
      return { code: 500, message: String(error) };
    }
  }

  @Get('/load-more')
  async loadMoreAudiobook(
    @Param('pageSize') pageSize: number,
    @Param('loadCount') loadCount: number,
  ): Promise<ISuccessResponse<ILoadMoreData<Track[]>> | IErrorResponse> {
    try {
      const list = await this.audiobookService.loadMoreAudiobook(
        pageSize,
        loadCount,
      );
      const total = await this.audiobookService.audiobookCount();
      return {
        code: 200,
        message: 'success',
        data: { pageSize, loadCount, list, total },
      };
    } catch (error) {
      return { code: 500, message: String(error) };
    }
  }

  @Get('/latest')
  async getLatestAudiobooks(): Promise<
    ISuccessResponse<Track[]> | IErrorResponse
  > {
    try {
      const list = await this.audiobookService.getLatestAudiobooks(8);
      return { code: 200, message: 'success', data: list };
    } catch (error) {
      return { code: 500, message: String(error) };
    }
  }

  @Post()
  async createAudiobook(
    @Body() track: Omit<Track, 'id'>,
  ): Promise<ISuccessResponse<Track> | IErrorResponse> {
    try {
      const data = await this.audiobookService.createAudiobook(track);
      return { code: 200, message: 'success', data };
    } catch (error) {
      return { code: 500, message: String(error) };
    }
  }

  @Put('/:id')
  async updateAudiobook(
    @Param('id') id: string,
    @Body() track: Partial<Track>,
  ): Promise<ISuccessResponse<Track> | IErrorResponse> {
    try {
      const data = await this.audiobookService.updateAudiobook(
        parseInt(id),
        track,
      );
      return { code: 200, message: 'success', data };
    } catch (error) {
      return { code: 500, message: String(error) };
    }
  }

  @Delete('/:id')
  async deleteAudiobook(
    @Param('id') id: string,
  ): Promise<ISuccessResponse<boolean> | IErrorResponse> {
    try {
      const ok = await this.audiobookService.deleteAudiobook(parseInt(id));
      return { code: 200, message: 'success', data: ok };
    } catch (error) {
      return { code: 500, message: String(error) };
    }
  }

  @Post('/batch-create')
  async createAudiobooks(
    @Body() tracks: Omit<Track, 'id'>[],
  ): Promise<ISuccessResponse<boolean> | IErrorResponse> {
    try {
      const ok = await this.audiobookService.createAudiobooks(tracks);
      if (ok) {
        return { code: 200, message: 'success', data: ok };
      }
      return { code: 500, message: '批量新增失败' };
    } catch (error) {
      return { code: 500, message: String(error) };
    }
  }

  @Delete('/batch-delete')
  async deleteAudiobooks(
    @Body() ids: number[],
  ): Promise<ISuccessResponse<boolean> | IErrorResponse> {
    try {
      const ok = await this.audiobookService.deleteAudiobooks(ids);
      if (ok) {
        return { code: 200, message: 'success', data: ok };
      }
      return { code: 500, message: '批量删除失败' };
    } catch (error) {
      return { code: 500, message: String(error) };
    }
  }

  // 新增：随机推荐 8 条未听过的有声书“专辑”（按 Track.album 聚合）
  @Get('/albums/recommend')
  async getRandomUnlistenedAudiobookAlbums(@Req() req: Request): Promise<
    ISuccessResponse<Track[]> | IErrorResponse
  > {
    try {
      const userId = (req.user as any)?.userId;
      const list =
        await this.audiobookService.getRandomUnlistenedAudiobookAlbums(Number(userId), 8);
      return { code: 200, message: 'success', data: list };
    } catch (error) {
      return { code: 500, message: String(error) };
    }
  }
}
