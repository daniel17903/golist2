FROM node:20.19.5-alpine3.22 AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/backend/package.json ./apps/backend/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/backend ./apps/backend
RUN npm run build -w apps/backend

FROM node:20.19.5-alpine3.22 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/backend/package.json ./apps/backend/package.json
RUN npm ci --omit=dev
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/src/db/migrations ./apps/backend/dist/db/migrations
RUN addgroup -g 1001 -S nodejs && adduser -S backend -u 1001
USER backend
EXPOSE 3000
CMD ["sh", "-c", "node apps/backend/dist/db/cli.js migrate && node apps/backend/dist/index.js"]
