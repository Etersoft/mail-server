# Сборка: docker build --target server -t mail-server .
#         docker build --target client -t mail-server-client .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN rm -f config.json && npm run server:build && npm run client:build

# API-сервер. Конфигурация — /app/config.json (поверх config.default.json),
# шаблон письма подписки — /app/templates/confirm-subscription.hbs
FROM node:22-alpine AS server
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY config.default.json ./
COPY templates ./templates
RUN [ -f templates/confirm-subscription.hbs ] || \
    cp templates/confirm-subscription.hbs.example templates/confirm-subscription.hbs
COPY --from=build /app/server/dist ./server/dist
USER node
EXPOSE 8000
CMD ["node", "server/dist/src/index.js"]

# Статический клиент; /api нужно проксировать на сервер (см. nginx.conf в стенде)
FROM nginx:1.27-alpine AS client
COPY --from=build /app/client/public /usr/share/nginx/html
