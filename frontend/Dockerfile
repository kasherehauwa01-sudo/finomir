FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_BASE_PATH=/vr/finomir/
ENV VITE_BASE_PATH=$VITE_BASE_PATH
COPY package*.json ./
RUN npm install
COPY . .
# Отдельная команда typecheck внутри npm run build не позволит собрать образ,
# если при merge потеряны типы, состояния или экспортируемые helper-функции.
RUN npm run build
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
HEALTHCHECK CMD wget -qO- http://localhost/ || exit 1
