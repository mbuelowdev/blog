# Stage 1: build static site from Markdown
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY deployment.json ./
COPY content ./content
COPY templates ./templates
COPY assets ./assets
COPY scripts ./scripts
RUN node scripts/build.mjs

# Stage 2: serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
