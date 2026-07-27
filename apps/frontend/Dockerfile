# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# P1-11: Edge middleware verifies JWTs with SECRET_KEY so it must be
# available at build time. Inlined via next.config.js env block. We
# allow the build to succeed without it in dev/test by defaulting the
# key to a throw-away placeholder; staging/production builds are gated
# by next.config.js.
ARG SECRET_KEY=dev-placeholder-key-must-be-32-chars-min
ARG ENV=production
ENV SECRET_KEY=$SECRET_KEY
ENV ENV=$ENV
RUN npm run build

# Run stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
