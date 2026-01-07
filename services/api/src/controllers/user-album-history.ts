import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { UserAlbumHistory } from '@soundx/db';
import { Request } from 'express';
import {
    IErrorResponse,
    ILoadMoreData,
    ISuccessResponse,
    ITableData,
} from 'src/common/const';
import { UserAlbumHistoryService } from '../services/user-album-history';

@Controller('user-album-histories')
export class UserAlbumHistoryController {
  constructor(
    private readonly userAlbumHistoryService: UserAlbumHistoryService,
  ) { }

  @Post()
  async create(
    @Req() req: Request,
    @Body() createUserAlbumHistoryDto: UserAlbumHistory,
  ): Promise<ISuccessResponse<any> | IErrorResponse> {
    try {
      const userId = (req.user as any)?.userId;
      const data = await this.userAlbumHistoryService.create({
        ...createUserAlbumHistoryDto,
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
      const data = await this.userAlbumHistoryService.findAll();
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

  @Delete(':id')
  async remove(
    @Param('id') id: string,
  ): Promise<ISuccessResponse<any> | IErrorResponse> {
    try {
      const data = await this.userAlbumHistoryService.remove(+id);
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
  async getUserAlbumHistoryTableList(
    @Param('pageSize') pageSize: number,
    @Param('current') current: number,
  ): Promise<
    ISuccessResponse<ITableData<UserAlbumHistory[]>> | IErrorResponse
  > {
    try {
      const list =
        await this.userAlbumHistoryService.getUserAlbumHistoryTableList(
          pageSize,
          current,
        );
      const total = await this.userAlbumHistoryService.userAlbumHistoryCount();
      return {
        code: 200,
        message: 'success',
        data: {
          pageSize,
          current,
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
  async loadMoreUserAlbumHistory(
    @Req() req: Request,
    @Query('pageSize') pageSize: string,
    @Query('loadCount') loadCount: string,
    @Query('type') type?: string,
  ): Promise<
    ISuccessResponse<ILoadMoreData<UserAlbumHistory[]>> | IErrorResponse
  > {
    try {
      const userId = (req.user as any)?.userId;
      const pageSizeNum = parseInt(pageSize, 10);
      const loadCountNum = parseInt(loadCount, 10);
      const userIdNum = Number(userId);

      const list = await this.userAlbumHistoryService.loadMoreUserAlbumHistory(
        pageSizeNum,
        loadCountNum,
        userIdNum,
        type,
      );
      const total = await this.userAlbumHistoryService.userAlbumHistoryCount(userIdNum);

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
      const data = await this.userAlbumHistoryService.findOne(+id);
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


