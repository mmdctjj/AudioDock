import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { TrackType } from '@soundx/db';
import { Request } from 'express';
import { PlaylistService } from '../services/playlist';

@Controller('playlists')
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) { }

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    try {
      const userId = (req.user as any)?.userId;
      const data = await this.playlistService.create({ ...body, userId });
      return { code: 200, message: 'success', data };
    } catch (error) {
      return { code: 500, message: error };
    }
  }

  @Get()
  async findAll(@Req() req: Request, @Query('type') type?: TrackType) {
    try {
      const userId = (req.user as any)?.userId;
      const data = await this.playlistService.findAll(Number(userId), type);
      return { code: 200, message: 'success', data };
    } catch (error) {
      return { code: 500, message: error };
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const data = await this.playlistService.findOne(+id);
      return { code: 200, message: 'success', data };
    } catch (error) {
      return { code: 500, message: error };
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    try {
      const data = await this.playlistService.update(+id, body);
      return { code: 200, message: 'success', data };
    } catch (error) {
      return { code: 500, message: error };
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.playlistService.remove(+id);
      return { code: 200, message: 'success' };
    } catch (error) {
      return { code: 500, message: error };
    }
  }

  @Post(':id/tracks')
  async addTrack(@Param('id') id: string, @Body('trackId') trackId: number) {
    try {
      const data = await this.playlistService.addTrack(+id, trackId);
      return { code: 200, message: 'success', data };
    } catch (error) {
      return { code: 500, message: error };
    }
  }

  @Post(':id/tracks/batch')
  async addTracks(@Param('id') id: string, @Body('trackIds') trackIds: number[]) {
    try {
      const data = await this.playlistService.addTracks(+id, trackIds);
      return { code: 200, message: 'success', data };
    } catch (error) {
      return { code: 500, message: error };
    }
  }

  @Delete(':id/tracks/:trackId')
  async removeTrack(@Param('id') id: string, @Param('trackId') trackId: string) {
    try {
      const data = await this.playlistService.removeTrack(+id, +trackId);
      return { code: 200, message: 'success', data };
    } catch (error) {
      return { code: 500, message: error };
    }
  }
}
