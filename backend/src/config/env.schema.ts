import { z } from 'zod';

const PROD_ENVS = new Set(['production', 'staging']);

export const envSchema = z
  .object({
    ENV: z.enum(['dev', 'test', 'staging', 'production']).default('dev'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    MINIO_ENDPOINT: z.string().min(1),
    MINIO_ACCESS_KEY: z.string().min(1),
    MINIO_SECRET_KEY: z.string().min(1),
    MINIO_BUCKET: z.string().min(1),
    MINIO_SECURE: z
      .union([z.literal('true'), z.literal('false')])
      .default('false')
      .transform((v) => v === 'true'),
    SECRET_KEY: z.string().min(1),
    ALGORITHM: z.string().default('HS256'),
    ACCESS_TOKEN_EXPIRE_MINUTES: z
      .string()
      .default('480')
      .transform((v) => parseInt(v, 10))
      .pipe(z.number().int().positive()),
    ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
    PHOTO_SIGNATURE_TTL: z
      .string()
      .default('900')
      .transform((v) => parseInt(v, 10))
      .pipe(z.number().int().positive()),
    LOGIN_RATE_LIMIT: z.string().default('5/minute'),
    PORT: z
      .string()
      .default('8000')
      .transform((v) => parseInt(v, 10))
      .pipe(z.number().int().positive()),
  })
  .superRefine((data, ctx) => {
    if (PROD_ENVS.has(data.ENV)) {
      if (data.SECRET_KEY === 'your-secret-key-change-in-production') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SECRET_KEY is set to the documented insecure fallback.',
          path: ['SECRET_KEY'],
        });
      }
      if (data.SECRET_KEY.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `SECRET_KEY must be at least 32 characters in ${data.ENV}`,
          path: ['SECRET_KEY'],
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
