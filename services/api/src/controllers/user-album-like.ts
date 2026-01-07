import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { UserAlbumLike } from '@soundx/db';
import { Request } from 'express';
import {
    IErrorResponse,
    ILoadMoreData,
    ISuccessResponse,
    ITableData,
} from 'src/common/const';
import { UserAlbumLikeService } from '../services/user-album-like';
@Controller('user-album-likes')
export class UserAlbumLikeController {
  constructor(private readonly userAlbumLikeService: UserAlbumLikeService) { }

  @Post()
  async create(
    @Req() req: Request,
    @Body() createUserAlbumLikeDto: UserAlbumLike,
  ): Promise<ISuccessResponse<any> | IErrorResponse> {
    try {
      const userId = (req.user as any)?.userId;
      const data = await this.userAlbumLikeService.create({
        ...createUserAlbumLikeDto,
        userId: Number(userId),
      });
      return {
        code: 200,
        message: 'success',
        data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Get()
  async findAll(): Promise<ISuccessResponse<any> | IErrorResponse> {
    try {
      const data = await this.userAlbumLikeService.findAll();
      return {
        code: 200,
        message: 'success',
        data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Delete('/unlike')
  async unlike(
    @Req() req: Request,
    @Query('albumId') albumId: string,
  ): Promise<ISuccessResponse<any> | IErrorResponse> {
    try {
      const userId = (req.user as any)?.userId;
      const albumIdNum = parseInt(albumId, 10);
      const data = await this.userAlbumLikeService.removeByUserAndAlbum(Number(userId), albumIdNum);
      return {
        code: 200,
        message: 'success',
        data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }

  @Get('/table-list')
  async getUserAlbumLikeTableList(
    @Query('pageSize') pageSize: string,
    @Query('current') current: string,
  ): Promise<ISuccessResponse<ITableData<UserAlbumLike[]>> | IErrorResponse> {
    try {
      const pageSizeNum = parseInt(pageSize, 10);
      const currentNum = parseInt(current, 10);
      const list = await this.userAlbumLikeService.getUserAlbumLikeTableList(
        pageSizeNum,
        currentNum,
      );
      const total = await this.userAlbumLikeService.userAlbumLikeCount();
      return {
        code: 200,
        message: 'success',
        data: {
          pageSize: pageSizeNum,
          current: currentNum,
          list,
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
  async loadMoreUserAlbumLike(
    @Req() req: Request,
    @Query('pageSize') pageSize: string,
    @Query('loadCount') loadCount: string,
    @Query('type') type?: string,
  ): Promise<
    ISuccessResponse<ILoadMoreData<UserAlbumLike[]>> | IErrorResponse
  > {
    try {
      const userId = (req.user as any)?.userId;
      const pageSizeNum = parseInt(pageSize, 10);
      const loadCountNum = parseInt(loadCount, 10);
      const userIdNum = Number(userId);

      const list = await this.userAlbumLikeService.loadMoreUserAlbumLike(
        pageSizeNum,
        loadCountNum,
        userIdNum,
        type,
      );
      const total = await this.userAlbumLikeService.userAlbumLikeCount();
      return {
        code: 200,
        message: 'success',
        data: {
          pageSize: pageSizeNum,
          loadCount: loadCountNum,
          list,
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

  @Get(':id')
  async findOne(
    @Param('id') id: string,
  ): Promise<ISuccessResponse<any> | IErrorResponse> {
    try {
      const data = await this.userAlbumLikeService.findOne(+id);
      return {
        code: 200,
        message: 'success',
        data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
      };
    }
  }
}
