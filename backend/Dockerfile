# Build stage
FROM docker.m.daocloud.io/node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
COPY ../prisma ./prisma
RUN npx prisma generate && npm run build

# Runtime stage
FROM docker.m.daocloud.io/node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 8000
# Re-run prisma generate at runtime in case node_modules layout differs
CMD ["sh", "-c", "npx prisma generate && node dist/src/main.js"]
