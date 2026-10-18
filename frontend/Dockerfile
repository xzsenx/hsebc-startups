FROM node:22-alpine AS build
WORKDIR /app
# npm 10 падает на дереве зависимостей Vite 8 (баг arborist), поэтому обновляем npm.
RUN npm install -g npm@11 --no-fund --no-audit
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
RUN npm run build

# Непривилегированный образ nginx: процесс работает не от root и слушает порт 8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf proxy-api.conf /etc/nginx/
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
