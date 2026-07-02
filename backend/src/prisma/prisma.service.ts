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
    this.$use(softDeleteMiddleware);
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
