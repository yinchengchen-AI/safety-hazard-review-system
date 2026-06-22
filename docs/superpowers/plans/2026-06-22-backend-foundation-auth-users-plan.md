# 全栈迁移 Phase 1：Backend Foundation + Auth/Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在独立分支上把 `backend/` 替换为可运行的 NestJS + Prisma 后端，实现与现有 FastAPI 等价的认证、当前用户、用户 CRUD、管理员重置密码、生产安全启动检查，并补齐单元/E2E 测试。

**Architecture:** 采用 NestJS 模块化架构，每个领域对应一个 Module；Prisma 通过 `db pull` 映射现有 PostgreSQL schema，并挂载 `$use` middleware 实现软删除；认证使用 `passport-local` + `passport-jwt`；环境变量用 `zod` 校验，保留生产弱密钥阻断逻辑。

**Tech Stack:** NestJS 10, Prisma 5, TypeScript 5, PostgreSQL 15, Redis 7, bcrypt, passport-jwt, @nestjs/throttler, pino/nestjs-pino, Jest, supertest.

> **范围说明**：本计划是 6 阶段全栈迁移中的 **Phase 1**，仅聚焦后端基础与 Auth/Users。Phase 2~6 将覆盖企业/隐患/批次/复核任务、照片/报告/队列、前端 Next.js 重写、统计/部署/生产切换，各自会单独产出 implementation plan。

---

## 文件结构

以下文件将在 `backend/` 目录下创建或修改。本计划假设在独立分支（如 `feat/fullstack-ts`）上工作，`backend/` 中的 Python 实现将在后续由本计划的新文件替代。

```
backend/
├── package.json
├── tsconfig.json
├── nest-cli.json
├── jest.config.js
├── .env.example
├── .gitignore
├── prisma/
│   ├── schema.prisma           # prisma db pull 生成
│   ├── seed.ts                 # 管理员账号种子
│   └── migrations/0_init/      # baseline 迁移
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   ├── env.schema.ts
│   │   └── config.module.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   ├── prisma.service.ts
│   │   └── soft-delete.middleware.ts
│   ├── common/
│   │   ├── security.util.ts
│   │   ├── security.util.spec.ts
│   │   ├── filters/all-exceptions.filter.ts
│   │   ├── interceptors/request-logging.interceptor.ts
│   │   └── decorators/current-user.decorator.ts
│   └── modules/
│       ├── health/
│       │   ├── health.module.ts
│       │   └── health.controller.ts
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.service.ts
│       │   ├── auth.controller.ts
│       │   ├── local.strategy.ts
│       │   ├── jwt.strategy.ts
│       │   ├── jwt-auth.guard.ts
│       │   ├── active-user.guard.ts
│       │   └── admin.guard.ts
│       └── users/
│           ├── users.module.ts
│           ├── users.service.ts
│           ├── users.controller.ts
│           └── dto/
│               ├── create-user.dto.ts
│               ├── update-user.dto.ts
│               └── user-response.dto.ts
└── test/
    ├── jest-e2e.json
    ├── setup.ts
    ├── auth.e2e-spec.ts
    └── users.e2e-spec.ts
```

---

### Task 1: 创建项目骨架与配置文件

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/nest-cli.json`
- Create: `backend/jest.config.js`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`

- [ ] **Step 1: 写入 `package.json`**

```json
{
  "name": "safety-hazard-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "db:seed": "ts-node prisma/seed.ts",
    "db:baseline": "prisma migrate resolve --applied 0_init"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/config": "^3.1.1",
    "@nestjs/core": "^10.3.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/swagger": "^7.2.0",
    "@nestjs/terminus": "^10.2.0",
    "@nestjs/throttler": "^5.1.0",
    "@prisma/client": "^5.7.0",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "nestjs-pino": "^4.0.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0",
    "pino-http": "^9.0.0",
    "pino-pretty": "^10.3.1",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.3.0",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.11",
    "@types/node": "^20.10.6",
    "@types/passport-jwt": "^3.0.13",
    "@types/passport-local": "^1.0.38",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "prisma": "^5.7.0",
    "supertest": "^6.3.3",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

- [ ] **Step 2: 写入 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 3: 写入 `nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 4: 写入 `jest.config.js`**

```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
```

- [ ] **Step 5: 写入 `.env.example`**

```bash
ENV=dev
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/safety_hazard
REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=hazard-photos
MINIO_SECURE=false
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
ALLOWED_ORIGINS=http://localhost:5173
PHOTO_SIGNATURE_TTL=900
LOGIN_RATE_LIMIT=5/minute
```

- [ ] **Step 6: 写入 `.gitignore`**

```gitignore
node_modules
dist
coverage
.env
.env.local
*.log
.DS_Store
```

- [ ] **Step 7: 安装依赖**

Run: `cd backend && npm install`
Expected: `node_modules` 创建完成，无报错。

---

### Task 2: 环境变量校验

**Files:**
- Create: `backend/src/config/env.schema.ts`
- Create: `backend/src/config/config.module.ts`

- [ ] **Step 1: 写入 `env.schema.ts`**

```typescript
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
      .string()
      .default('false')
      .transform((v) => v === 'true'),
    SECRET_KEY: z.string().min(1),
    ALGORITHM: z.string().default('HS256'),
    ACCESS_TOKEN_EXPIRE_MINUTES: z
      .string()
      .default('480')
      .transform((v) => parseInt(v, 10)),
    ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
    PHOTO_SIGNATURE_TTL: z
      .string()
      .default('900')
      .transform((v) => parseInt(v, 10)),
    LOGIN_RATE_LIMIT: z.string().default('5/minute'),
  })
  .superRefine((data, ctx) => {
    if (PROD_ENVS.has(data.ENV)) {
      if (data.SECRET_KEY === 'your-secret-key-change-in-production') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SECRET_KEY is set to the documented insecure fallback. Generate a real one.',
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
```

- [ ] **Step 2: 写入 `config.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => envSchema.parse(config),
      isGlobal: true,
    }),
  ],
})
export class AppConfigModule {}
```

---

### Task 3: Prisma Schema 初始化与 Baseline

**Files:**
- Create/Generate: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/0_init/migration.sql`

**Prerequisite:** 本地 Postgres 已运行且包含现有 `safety_hazard` 数据库。

- [ ] **Step 1: 初始化 Prisma**

Run: `cd backend && npx prisma init`
Expected: 创建 `prisma/schema.prisma` 与 `.env`（如不存在）。

- [ ] **Step 2: 设置数据库连接**

确保 `.env` 中：
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/safety_hazard"
```

- [ ] **Step 3: 从现有数据库反向生成 schema**

Run: `cd backend && npx prisma db pull`
Expected: `prisma/schema.prisma` 被填充为与现有数据库等价的模型，包含 `users` 等所有表。

- [ ] **Step 4: 生成 baseline 迁移 SQL**

Run:
```bash
cd backend
mkdir -p prisma/migrations/0_init
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql
```
Expected: `prisma/migrations/0_init/migration.sql` 包含完整的 `CREATE TABLE` 等语句。

- [ ] **Step 5: 生成 Prisma Client**

Run: `cd backend && npx prisma generate`
Expected: `@prisma/client` 可用。

- [ ] **Step 6: 标记 baseline 迁移已应用**

Run: `cd backend && npm run db:baseline`
Expected: 输出 `Migration 0_init marked as applied.`

---

### Task 4: Prisma Service 与软删除中间件

**Files:**
- Create: `backend/src/prisma/soft-delete.middleware.ts`
- Create: `backend/src/prisma/prisma.service.ts`
- Create: `backend/src/prisma/prisma.module.ts`

- [ ] **Step 1: 写入 `soft-delete.middleware.ts`**

```typescript
import { Prisma } from '@prisma/client';

const SOFT_DELETE_MODELS = [
  'User',
  // Phase 2~6 按需追加其他带 deletedAt 的模型
];

export const softDeleteMiddleware: Prisma.Middleware = async (params, next) => {
  if (!SOFT_DELETE_MODELS.includes(params.model ?? '')) {
    return next(params);
  }

  if (params.action === 'findUnique') {
    return next({
      ...params,
      action: 'findFirst',
      args: {
        ...params.args,
        where: {
          ...params.args?.where,
          deletedAt: null,
        },
      },
    });
  }

  if (['findMany', 'findFirst', 'count'].includes(params.action)) {
    return next({
      ...params,
      args: {
        ...params.args,
        where: {
          ...params.args?.where,
          deletedAt: null,
        },
      },
    });
  }

  if (params.action === 'delete') {
    return next({
      ...params,
      action: 'update',
      args: {
        ...params.args,
        data: { deletedAt: new Date() },
      },
    });
  }

  if (params.action === 'deleteMany') {
    return next({
      ...params,
      action: 'updateMany',
      args: {
        ...params.args,
        data: { deletedAt: new Date() },
      },
    });
  }

  return next(params);
};
```

- [ ] **Step 2: 写入 `prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { softDeleteMiddleware } from './soft-delete.middleware';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super();
    this.$use(softDeleteMiddleware);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 3: 写入 `prisma.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

### Task 5: 安全工具（bcrypt + JWT）

**Files:**
- Create: `backend/src/common/security.util.ts`
- Create: `backend/src/common/security.util.spec.ts`

- [ ] **Step 1: 写入 `security.util.ts`**

```typescript
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): string {
  const bytes = Buffer.from(password, 'utf-8').slice(0, 72);
  return bcrypt.hashSync(bytes, BCRYPT_ROUNDS);
}

export function verifyPassword(plainPassword: string, hashedPassword: string): boolean {
  if (!plainPassword || !hashedPassword) return false;
  try {
    const bytes = Buffer.from(plainPassword, 'utf-8').slice(0, 72);
    return bcrypt.compareSync(bytes, hashedPassword);
  } catch {
    return false;
  }
}

function parseCostFactor(hash: string): number | null {
  const parts = hash.split('$');
  if (parts.length < 4) return null;
  const cost = parseInt(parts[2], 10);
  return Number.isNaN(cost) ? null : cost;
}

export function needsRehash(hashedPassword: string): boolean {
  const cost = parseCostFactor(hashedPassword);
  if (cost === null) return true;
  return cost < BCRYPT_ROUNDS;
}
```

- [ ] **Step 2: 写入 `security.util.spec.ts`**

```typescript
import { hashPassword, verifyPassword, needsRehash } from './security.util';

describe('security.util', () => {
  it('hashes and verifies a password', () => {
    const hash = hashPassword('admin123');
    expect(verifyPassword('admin123', hash)).toBe(true);
    expect(verifyPassword('wrong', hash)).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(verifyPassword('', 'hash')).toBe(false);
    expect(verifyPassword('pwd', '')).toBe(false);
  });

  it('detects rehash need for low cost hashes', () => {
    const oldHash = '$2b$06$abcdefghijklmnopqrstuuVSP8w1A1fQLX4X5X6X7X8';
    expect(needsRehash(oldHash)).toBe(true);
  });

  it('does not require rehash for current cost hashes', () => {
    const hash = hashPassword('admin123');
    expect(needsRehash(hash)).toBe(false);
  });
});
```

- [ ] **Step 3: 运行单元测试**

Run: `cd backend && npm test -- security.util.spec`
Expected: 4 tests PASS。

---

### Task 6: AuthModule

**Files:**
- Create: `backend/src/modules/auth/auth.module.ts`
- Create: `backend/src/modules/auth/auth.service.ts`
- Create: `backend/src/modules/auth/auth.controller.ts`
- Create: `backend/src/modules/auth/local.strategy.ts`
- Create: `backend/src/modules/auth/jwt.strategy.ts`
- Create: `backend/src/modules/auth/jwt-auth.guard.ts`
- Create: `backend/src/modules/auth/active-user.guard.ts`
- Create: `backend/src/modules/auth/admin.guard.ts`
- Create: `backend/src/common/decorators/current-user.decorator.ts`

- [ ] **Step 1: 写入 `auth.service.ts`**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword, needsRehash, verifyPassword } from '../../common/security.util';
import { Env } from '../../config/env.schema';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService<Env, true>,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, isActive: true },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Incorrect username or password');
    }

    if (needsRehash(user.passwordHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(password) },
      });
    }

    return user;
  }

  login(user: { id: string; username: string; role: string }) {
    const expiresIn = this.config.get('ACCESS_TOKEN_EXPIRE_MINUTES', { infer: true });
    const payload = { sub: user.id };
    return {
      access_token: this.jwt.sign(payload, { expiresIn: `${expiresIn}m` }),
      token_type: 'bearer',
    };
  }
}
```

- [ ] **Step 2: 写入 `local.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(username: string, password: string) {
    return this.authService.validateUser(username, password);
  }
}
```

- [ ] **Step 3: 写入 `jwt.strategy.ts`**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Env } from '../../config/env.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('SECRET_KEY', { infer: true }),
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
```

- [ ] **Step 4: 写入 Guards**

`jwt-auth.guard.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

`active-user.guard.ts`:
```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user || !user.isActive || user.deletedAt) {
      throw new ForbiddenException('Inactive or deleted user');
    }
    return true;
  }
}
```

`admin.guard.ts`:
```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (user?.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
```

- [ ] **Step 5: 写入 `current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: keyof any | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
```

- [ ] **Step 6: 写入 `auth.controller.ts`**

```typescript
import { Controller, Post, Get, UseGuards, Request, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ActiveUserGuard } from './active-user.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class LoginDto {
  username: string;
  password: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @UseGuards(AuthGuard('local'))
  async login(@Request() req: any, @Body() _dto: LoginDto) {
    return this.authService.login(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  me(@CurrentUser() user: any) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      is_active: user.isActive,
    };
  }
}
```

- [ ] **Step 7: 写入 `auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { Env } from '../../config/env.schema';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('SECRET_KEY', { infer: true }),
        signOptions: {
          algorithm: config.get('ALGORITHM', { infer: true }) as any,
        },
      }),
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
```

---

### Task 7: UsersModule

**Files:**
- Create: `backend/src/modules/users/users.module.ts`
- Create: `backend/src/modules/users/users.service.ts`
- Create: `backend/src/modules/users/users.controller.ts`
- Create: `backend/src/modules/users/dto/create-user.dto.ts`
- Create: `backend/src/modules/users/dto/update-user.dto.ts`
- Create: `backend/src/modules/users/dto/user-response.dto.ts`

- [ ] **Step 1: 写入 DTOs**

`create-user.dto.ts`:
```typescript
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsIn(['admin', 'inspector'])
  role: string = 'inspector';

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
```

`update-user.dto.ts`:
```typescript
import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['admin', 'inspector'])
  role?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
```

`user-response.dto.ts`:
```typescript
export class UserResponseDto {
  id: string;
  username: string;
  role: string;
  fullName: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  deletedAt: Date | null;
}
```

- [ ] **Step 2: 写入 `users.service.ts`**

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword } from '../../common/security.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException('Username already exists');
    }
    return this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash: hashPassword(dto.password),
        role: dto.role,
        fullName: dto.fullName ?? null,
        phone: dto.phone ?? null,
      },
    });
  }

  async findAll(page = 1, size = 20) {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * size,
        take: size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return { items, total };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const data: any = {};
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password !== undefined) data.passwordHash = hashPassword(dto.password);
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
```

- [ ] **Step 3: 写入 `users.controller.ts`**

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveUserGuard } from '../auth/active-user.guard';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, ActiveUserGuard, AdminGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  findAll(@Query('page') page?: string, @Query('size') size?: string) {
    return this.usersService.findAll(
      page ? parseInt(page, 10) : 1,
      size ? parseInt(size, 10) : 20,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
```

- [ ] **Step 4: 写入 `users.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
```

---

### Task 8: 管理员种子脚本

**Files:**
- Create: `backend/prisma/seed.ts`

- [ ] **Step 1: 写入 `seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/security.util';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';

  const existing = await prisma.user.findFirst({ where: { username } });
  if (!existing) {
    await prisma.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        role: 'admin',
        fullName: '系统管理员',
        isActive: true,
      },
    });
    console.log(`Created admin user: ${username}`);
  } else {
    console.log(`Admin user ${username} already exists`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: 测试种子脚本**

Run: `cd backend && npx prisma db seed`
Expected: 输出 `Created admin user: admin` 或已存在提示。

---

### Task 9: 健康检查

**Files:**
- Create: `backend/src/modules/health/health.controller.ts`
- Create: `backend/src/modules/health/health.module.ts`

- [ ] **Step 1: 写入 `health.controller.ts`**

```typescript
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([]);
  }
}
```

- [ ] **Step 2: 写入 `health.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

---

### Task 10: 全局异常过滤与请求日志

**Files:**
- Create: `backend/src/common/filters/all-exceptions.filter.ts`
- Create: `backend/src/common/interceptors/request-logging.interceptor.ts`

- [ ] **Step 1: 写入 `all-exceptions.filter.ts`**

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      detail = typeof res === 'string' ? res : (res as any).message ?? JSON.stringify(res);
    }

    response.status(status).json({
      detail,
      status_code: status,
    });
  }
}
```

- [ ] **Step 2: 写入 `request-logging.interceptor.ts`**

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, originalUrl } = req;
    const userId = req.user?.id;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const status = response.statusCode;
        this.logger.log(
          `${method} ${originalUrl} ${status} +${Date.now() - now}ms user=${userId ?? '-'}`,
        );
      }),
    );
  }
}
```

---

### Task 11: 组装 AppModule 与 main.ts

**Files:**
- Create: `backend/src/app.module.ts`
- Create: `backend/src/main.ts`

- [ ] **Step 1: 写入 `app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'login',
        ttl: 60000,
        limit: 5,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: 写入 `main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Safety Hazard API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
```

- [ ] **Step 3: 启动开发服务器验证**

Run: `cd backend && npm run start:dev`
Expected: 服务在 `http://localhost:8000` 启动，`GET /api/v1/health` 返回 `{ status: 'ok', info: {}, error: {}, details: {} }`。

---

### Task 12: Auth/Users E2E 测试

**Files:**
- Create: `backend/test/jest-e2e.json`
- Create: `backend/test/setup.ts`
- Create: `backend/test/auth.e2e-spec.ts`
- Create: `backend/test/users.e2e-spec.ts`

- [ ] **Step 1: 写入 `jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "setupFilesAfterEnv": ["<rootDir>/setup.ts"]
}
```

- [ ] **Step 2: 写入 `setup.ts`**

```typescript
import { execSync } from 'child_process';

beforeAll(async () => {
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/safety_hazard_test';
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  execSync('npx prisma db seed', {
    stdio: 'inherit',
    env: { ...process.env, ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'admin123' },
  });
});
```

- [ ] **Step 3: 写入 `auth.e2e-spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/auth/login (POST) returns token for admin', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200)
      .expect((res) => {
        expect(res.body.access_token).toBeDefined();
        expect(res.body.token_type).toBe('bearer');
      });
  });

  it('/api/v1/auth/login (POST) rejects wrong password', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'wrong' })
      .expect(401);
  });

  it('/api/v1/auth/me (GET) returns current user', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    return request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.username).toBe('admin');
        expect(res.body.role).toBe('admin');
      });
  });
});
```

- [ ] **Step 4: 写入 `users.e2e-spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    token = login.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/users (POST) creates a user', () => {
    return request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'inspector1', password: 'pass1234', role: 'inspector' })
      .expect(201)
      .expect((res) => {
        expect(res.body.username).toBe('inspector1');
        expect(res.body.role).toBe('inspector');
      });
  });

  it('/api/v1/users (GET) lists users', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(typeof res.body.total).toBe('number');
      });
  });
});
```

- [ ] **Step 5: 运行 E2E 测试**

Run:
```bash
cd backend
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/safety_hazard_test npm run test:e2e
```
Expected: 所有测试 PASS。

---

### Task 13: 提交 Phase 1 代码

- [ ] **Step 1: 添加并提交**

Run:
```bash
git add backend/package.json backend/tsconfig.json backend/nest-cli.json backend/jest.config.js backend/.env.example backend/.gitignore
backend/prisma backend/src backend/test
git commit -m "feat(backend): Phase 1 NestJS foundation + auth/users

- NestJS 10 + Prisma 5 + TypeScript 5 项目骨架
- zod 环境变量校验 + 生产弱密钥阻断
- Prisma db pull + baseline 迁移 + 软删除中间件
- bcrypt 密码哈希与自动 rehash
- passport-local + passport-jwt 认证
- 用户 CRUD + 管理员 Guard
- Pino 日志 + 全局异常过滤 + 请求日志
- Jest 单元测试 + supertest E2E 测试

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Expected: 提交成功，Phase 1 完成。

---

## Self-Review

### 1. Spec coverage

| Spec 章节 | 本计划对应任务 |
|-----------|----------------|
| 3.2 后端模块划分 | AuthModule、UsersModule 已覆盖，其他模块在后续 Phase |
| 3.3 后端项目结构 | Task 1 建立结构 |
| 4.1 Prisma Schema 生成 | Task 3 |
| 4.2 软删除 | Task 4 |
| 4.3 Baseline 迁移 | Task 3 |
| 5.1 认证 | Task 6 |
| 5.2 Guard 体系 | Task 6 |
| 5.3 限流 | Task 11（基础配置，登录专项限流在 Phase 2 细化） |
| 5.4 生产安全启动检查 | Task 2 |
| 8.5 API 客户端（OpenAPI） | Task 11 Swagger 已启用 |
| 9.3 错误处理 | Task 10 |
| 9.5 日志 | Task 10/11 |
| 10.1 后端测试 | Task 5/12 |
| 11 实施阶段 | 本计划覆盖阶段 1 |

**Gap**: 限流登录接口专项 `5/minute` 未在 Phase 1 完全落地（@nestjs/throttler 的全局配置已加，但登录接口的命名限流 guard 会在 Phase 2 补齐）。

### 2. Placeholder scan

- 无 `TBD`/`TODO`。
- 所有代码块均含实际可运行代码。
- 命令含预期输出。

### 3. Type consistency

- DTO 字段与 Prisma `User` 模型（camelCase）一致。
- `AuthService.login` 接收 `id/username/role` 与 JWT payload 一致。
- `CurrentUser` decorator 返回 `request.user`，与 JwtStrategy 注入一致。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-backend-foundation-auth-users-plan.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach would you like?
