/**
 * Runtime safety checks performed during application startup.
 *
 * In production / staging we refuse to boot when:
 *  - The default admin / admin123 account is still present in the database.
 *  - SECRET_KEY is the documented insecure placeholder or shorter than 32 chars
 *    (already enforced by env.schema.ts in dev, but we re-check here in case
 *    the config layer was bypassed).
 */
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword, INSECURE_DEFAULT_SECRET } from './security.util';

const DEFAULT_PASSWORD = 'admin123';
const DEFAULT_USERNAME = 'admin';
const PROD_ENVS = new Set(['production', 'staging']);

@Injectable()
export class StartupChecksService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupChecksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const env = this.config.get<string>('ENV', 'dev');
    const secret = this.config.get<string>('SECRET_KEY', '');

    if (PROD_ENVS.has(env)) {
      if (secret === INSECURE_DEFAULT_SECRET || secret.length < 32) {
        throw new Error(
          `Refusing to start in ${env}: SECRET_KEY is weak or set to the documented insecure fallback. ` +
            `Generate a real one with: openssl rand -hex 32`,
        );
      }
    }

    try {
      const user = await this.prisma.users.findFirst({
        where: { username: DEFAULT_USERNAME },
      });
      if (user && verifyPassword(DEFAULT_PASSWORD, user.password_hash)) {
        if (PROD_ENVS.has(env)) {
          throw new Error(
            `Refusing to start in ${env} with the default admin/${DEFAULT_PASSWORD} account. ` +
              `Change the password before deploying to production.`,
          );
        } else {
          this.logger.warn(
            `default admin/${DEFAULT_PASSWORD} account is still present (ENV=${env}). ` +
              `Change the password before deploying to production.`,
          );
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Refusing to start')) {
        throw err;
      }
      this.logger.warn(`startup_checks: could not query users table: ${err}`);
    }
  }
}
