import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginRequest, TokenResponse } from './dto/token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { users } from '@prisma/client';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponse> {
    const result = await this.auth.login(body.username, body.password);
    // Set httpOnly cookie so the browser SPA does not need to manage
    // the JWT itself. Direct API consumers can still use the body.
    res.setHeader('Set-Cookie', this.auth.buildAuthCookie(result.access_token, this.auth.isProd()));
    return { access_token: result.access_token, token_type: 'bearer' };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Res({ passthrough: true }) res: Response): Promise<void> {
    res.setHeader('Set-Cookie', this.auth.buildClearCookie(this.auth.isProd()));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  async me(@CurrentUser() user: users) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
    };
  }
}
