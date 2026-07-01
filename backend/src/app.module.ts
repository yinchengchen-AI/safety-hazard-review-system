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
import { PhotosModule } from './modules/photos/photos.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { StorageModule } from './storage/storage.module';
import { BullmqModule } from './queues/bullmq.module';
import { ReportProcessor } from './queues/report.processor';
import { ReportRenderer } from './queues/report-renderer';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    StartupChecksModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    AuthModule,
    UsersModule,
    StorageModule,
    BullmqModule,
    EnterprisesModule,
    HazardsModule,
    BatchesModule,
    ReviewTasksModule,
    PhotosModule,
    ReportsModule,
    NotificationsModule,
    StatisticsModule,
    AuditLogsModule,
    HealthModule,
  ],
  providers: [
    ReportProcessor,
    ReportRenderer,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
