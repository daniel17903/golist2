FROM node:24.8.0-alpine3.22 AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared
RUN npm run build -w apps/backend

FROM node:24.8.0-alpine3.22 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci --omit=dev
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/src/db/migrations ./apps/backend/dist/db/migrations
COPY --from=build /app/packages/shared ./packages/shared
RUN addgroup -g 1001 -S nodejs && adduser -S backend -u 1001
USER backend
EXPOSE 3000
CMD ["sh", "-c", "node apps/backend/dist/db/cli.js migrate && node apps/backend/dist/index.js"]
