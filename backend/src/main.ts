import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const env = config.get<string>('ENV', 'dev');

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));
  app.enableCors({
    origin: config.get<string>('ALLOWED_ORIGINS', 'http://localhost:5173')
      .split(',').map((s) => s.trim()).filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
  });

  const port = config.get<number>('PORT', 8000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`safety-hazard-backend listening on :${port} (env=${env})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('failed to start:', err);
  process.exit(1);
});
