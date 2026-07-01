import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { StartupChecksModule } from './common/startup-checks.module';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { EnterprisesModule } from './modules/enterprises/enterprises.module';
import { HazardsModule } from './modules/hazards/hazards.module';
import { BatchesModule } from './modules/batches/batches.module';
import { ReviewTasksModule } from './modules/review-tasks/review-tasks.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    StartupChecksModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    AuthModule,
    UsersModule,
    EnterprisesModule,
    HazardsModule,
    BatchesModule,
    ReviewTasksModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
