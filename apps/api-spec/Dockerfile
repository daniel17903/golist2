# syntax=docker/dockerfile:1.7

FROM node:24.8.0-alpine AS build
WORKDIR /app

# Install workspace dependencies and build the API docs.
COPY package.json package-lock.json ./
COPY apps/api-spec/package.json apps/api-spec/package.json
RUN npm ci

COPY apps/api-spec/openapi.yaml apps/api-spec/openapi.yaml
WORKDIR /app/apps/api-spec
RUN npm run build

FROM nginx:1.27.5-alpine AS runtime

# Serve the generated static docs.
COPY --from=build /app/apps/api-spec/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
