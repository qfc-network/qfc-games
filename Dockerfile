FROM node:20-alpine AS builder
WORKDIR /app
COPY lobby/package*.json ./
RUN npm ci
COPY lobby/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 3200;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /health {
        access_log off;
        return 200 'ok';
    }
}
EOF
EXPOSE 3200
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3200/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
