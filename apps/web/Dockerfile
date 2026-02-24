FROM node:24.8.0-alpine3.22 AS build
WORKDIR /app

COPY package.json ./package.json

# @golist/shared is a workspace-local type-only dependency used in source imports.
# In isolated frontend builds (context=apps/web), that workspace package is not present.
RUN npm pkg delete dependencies.@golist/shared
RUN npm install

COPY . ./
RUN npm run build

FROM nginx:1.29.1-alpine3.22 AS runtime
WORKDIR /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist ./

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
