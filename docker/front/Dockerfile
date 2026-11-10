FROM node:26.13.0-alpine AS build
WORKDIR /app
COPY front/package.json front/package-lock.json ./
RUN npm ci
COPY front/ ./
RUN npm run build

FROM caddy:2.11.9-alpine
RUN adduser -D -H -u 1000 app
COPY docker/front/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist/front/browser /srv
USER app
EXPOSE 8080
