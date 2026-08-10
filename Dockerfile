FROM node:22-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime

ENV NODE_ENV=production
ENV API_PORT=4000

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server

EXPOSE 4000
CMD ["node", "server/index.mjs"]
