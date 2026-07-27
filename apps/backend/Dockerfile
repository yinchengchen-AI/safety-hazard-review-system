# NestJS API image. Built with the backend/ directory as context so
# all package.json / prisma / src paths are relative to it.
FROM docker.m.daocloud.io/node:20-alpine AS builder
WORKDIR /app
# openssl must exist before `prisma generate`, otherwise Prisma cannot
# detect the system OpenSSL 3 and defaults to a 1.1 engine that won't
# load at runtime.
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
COPY prisma ./prisma
COPY test ./test
RUN npx prisma generate && npm run build

# Runtime stage
FROM docker.m.daocloud.io/node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 8000
CMD ["sh", "-c", "npx prisma generate && node dist/src/main.js"]
