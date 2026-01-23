import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { Track, TrackType } from '@soundx/db';
import {
    IErrorResponse,
    ILoadMoreData,
    ISuccessResponse,
    ITableData,
} from 'src/common/const';
import { Public } from 'src/common/public.decorator';
import { TrackService } from '../services/track';

@Controller()
export class TrackController {
  constructor(private readonly trackService: TrackService) { }

  @Get('/track/list')
  async getTrackList(): Promise<ISuccessResponse<Track[]> | IErrorResponse> {
    try {
      const trackList = await this.trackService.getTrackList();
      return {
        code: 200,
        message: 'success',
        data: trackList,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Get('/table-list')
  async getTrackTableList(
    @Query('pageSize') pageSize: any,
    @Query('current') current: any,
    @Query('type') type?: TrackType,
  ): Promise<ISuccessResponse<ITableData<Track[]>> | IErrorResponse> {
    try {
      const size = Number(pageSize);
      const cur = Number(current);
      const trackList = await this.trackService.getTrackTableList(
        size,
        cur,
      );
      const total = await this.trackService.trackCount(type);
      return {
        code: 200,
        message: 'success',
        data: {
          pageSize: size,
          current: cur,
          list: trackList,
          total,
        },
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Get('/load-more')
  async loadMoreTrack(
    @Query('pageSize') pageSize: any,
    @Query('loadCount') loadCount: any,
    @Query('type') type?: TrackType,
  ): Promise<ISuccessResponse<ILoadMoreData<Track[]>> | IErrorResponse> {
    try {
      const size = Number(pageSize);
      const count = Number(loadCount);
      const trackList = await this.trackService.loadMoreTrack(
        size,
        count,
        type,
      );
      const total = await this.trackService.trackCount(type);
      return {
        code: 200,
        message: 'success',
        data: {
          pageSize: size,
          loadCount: count,
          list: trackList,
          total,
        },
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Public()
  @Post('/track')
  async createTrack(
    @Body() track: Omit<Track, 'id'>,
  ): Promise<ISuccessResponse<Track> | IErrorResponse> {
    try {
      const trackInfo = await this.trackService.createTrack(track);
      return {
        code: 200,
        message: 'success',
        data: trackInfo,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Put('/track/:id')
  async updateTrack(
    @Param('id') id: string,
    @Body() track: Partial<Track>,
  ): Promise<ISuccessResponse<Track> | IErrorResponse> {
    try {
      const trackInfo = await this.trackService.updateTrack(
        parseInt(id),
        track,
      );
      return {
        code: 200,
        message: 'success',
        data: trackInfo,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Delete('/track/:id')
  async deleteTrack(
    @Param('id') id: string,
    @Query('deleteAlbum') deleteAlbum?: string,
  ): Promise<ISuccessResponse<boolean> | IErrorResponse> {
    try {
      const isSuccess = await this.trackService.deleteTrack(
        parseInt(id)
      );
      return {
        code: 200,
        message: 'success',
        data: isSuccess,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Get('/track/:id/deletion-impact')
  async getDeletionImpact(
    @Param('id') id: string,
  ): Promise<ISuccessResponse<{ isLastTrackInAlbum: boolean; albumName: string | null }> | IErrorResponse> {
    try {
      const impact = await this.trackService.checkDeletionImpact(parseInt(id));
      return {
        code: 200,
        message: 'success',
        data: impact,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Post('/track/batch-create')
  async createTracks(
    @Body() tracks: Omit<Track, 'id'>[],
  ): Promise<ISuccessResponse<boolean> | IErrorResponse> {
    try {
      const trackInfo = await this.trackService.createTracks(tracks);
      if (trackInfo) {
        return {
          code: 200,
          message: 'success',
          data: trackInfo,
        };
      } else {
        return {
          code: 500,
          message: '批量新增失败',
        };
      }
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Delete('/track/batch-delete')
  async deleteTracks(
    @Body() ids: number[],
  ): Promise<ISuccessResponse<boolean> | IErrorResponse> {
    try {
      const result = await this.trackService.deleteTracks(ids);
      if (result) {
        return {
          code: 200,
          message: 'success',
          data: result,
        };
      } else {
        return {
          code: 500,
          message: '批量删除失败',
        };
      }
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Get('/track/search')
  async searchTracks(
    @Query('keyword') keyword: string,
    @Query('type') type?: TrackType,
    @Query('limit') limit?: string,
  ): Promise<ISuccessResponse<Track[]> | IErrorResponse> {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 10;
      const tracks = await this.trackService.searchTracks(keyword, type, limitNum);
      return {
        code: 200,
        message: 'success',
        data: tracks,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }
  @Get('/track/latest')
  async getLatestTracks(
    @Query('type') type?: TrackType,
    @Query('random') random?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ISuccessResponse<Track[]> | IErrorResponse> {
    try {
      const isRandom = random === 'true';
      const limit = pageSize ? parseInt(pageSize, 10) : 8;
      const tracks = isRandom
        ? await this.trackService.getRandomTracks(type, limit)
        : await this.trackService.getLatestTracks(type, limit);
      return {
        code: 200,
        message: 'success',
        data: tracks,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Get('/track/artist')
  async getTracksByArtist(
    @Query('artist') artist: string,
  ): Promise<ISuccessResponse<Track[]> | IErrorResponse> {
    try {
      const tracks = await this.trackService.getTracksByArtist(artist);
      return {
        code: 200,
        message: 'success',
        data: tracks,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }
}
