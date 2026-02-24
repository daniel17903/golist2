FROM node:24.8.0-alpine3.22 AS deps
WORKDIR /app

COPY package*.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
RUN npm run build -w apps/web

FROM nginx:1.29.1-alpine3.22 AS runtime
WORKDIR /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist ./
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
