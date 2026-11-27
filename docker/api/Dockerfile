FROM node:26.13.0-alpine AS build
WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/ ./
RUN npm run build && npm prune --omit=dev

FROM node:26.13.0-alpine
ENV NODE_ENV=production
# pg_dump, pour l'export de toute la donnée depuis l'écran d'administration. Sa version
# majeure suit celle de la base (compose.yaml) : pg_dump refuse une base plus récente que lui.
RUN apk add --no-cache postgresql18-client
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Le volume des fichiers envoyés hérite de ce dossier et de son propriétaire.
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
