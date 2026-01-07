import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { UserAudiobookHistory } from '@soundx/db';
import { Request } from 'express';
import {
  IErrorResponse,
  ILoadMoreData,
  ISuccessResponse,
  ITableData,
} from 'src/common/const';
import { UserAudiobookHistoryService } from '../services/user-audiobook-history';

@Controller('user-audiobook-histories')
export class UserAudiobookHistoryController {
  constructor(
    private readonly userAudiobookHistoryService: UserAudiobookHistoryService,
  ) { }

  @Post()
  async create(
    @Req() req: Request,
    @Body() createUserAudiobookHistoryDto: UserAudiobookHistory,
  ): Promise<ISuccessResponse<any> | IErrorResponse> {
    try {
      const userId = (req.user as any)?.userId;
      const data = await this.userAudiobookHistoryService.create({
        ...createUserAudiobookHistoryDto,
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
      const data = await this.userAudiobookHistoryService.findAll();
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

  @Get(':id')
  async findOne(
    @Param('id') id: string,
  ): Promise<ISuccessResponse<any> | IErrorResponse> {
    try {
      const data = await this.userAudiobookHistoryService.findOne(+id);
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
      const data = await this.userAudiobookHistoryService.remove(+id);
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
  async getUserAudiobookHistoryTableList(
    @Param('pageSize') pageSize: number,
    @Param('current') current: number,
  ): Promise<
    ISuccessResponse<ITableData<UserAudiobookHistory[]>> | IErrorResponse
  > {
    try {
      const list =
        await this.userAudiobookHistoryService.getUserAudiobookHistoryTableList(
          pageSize,
          current,
        );
      const total =
        await this.userAudiobookHistoryService.userAudiobookHistoryCount();
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
  async loadMoreUserAudiobookHistory(
    @Param('pageSize') pageSize: number,
    @Param('loadCount') loadCount: number,
  ): Promise<
    ISuccessResponse<ILoadMoreData<UserAudiobookHistory[]>> | IErrorResponse
  > {
    try {
      const list =
        await this.userAudiobookHistoryService.loadMoreUserAudiobookHistory(
          pageSize,
          loadCount,
        );
      const total =
        await this.userAudiobookHistoryService.userAudiobookHistoryCount();
      return {
        code: 200,
        message: 'success',
        data: {
          pageSize,
          loadCount,
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
}
