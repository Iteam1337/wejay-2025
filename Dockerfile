FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/vite.config.ts ./
COPY --from=builder /app/vite-plugin-*.ts ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S wejay -u 1001

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

USER wejay

# Use the production server with Socket.IO support
CMD ["node", "dist/server.js"]
