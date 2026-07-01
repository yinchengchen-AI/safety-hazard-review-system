import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { softDeleteMiddleware } from './soft-delete.middleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    console.log('[PrismaService] onModuleInit, registering soft-delete middleware');
    this.$use(softDeleteMiddleware);
    console.log('[PrismaService] middleware registered, count:', (this as any)._middlewareParams?.count ?? 'unknown');
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
