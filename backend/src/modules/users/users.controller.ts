import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
  UserListResponseDto,
  UserResponseDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard, AdminGuard } from '../../common/guards';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, ActiveUserGuard, AdminGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.users.create(dto);
  }

  @Get()
  list(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('page_size', new ParseIntPipe({ optional: true })) pageSize = 20,
    @Query('keyword') keyword = '',
  ): Promise<UserListResponseDto> {
    return this.users.list(page, pageSize, keyword);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.users.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.users.update(id, dto);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<UserResponseDto> {
    return this.users.resetPassword(id, dto.new_password);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.users.remove(id);
  }
}
