# Stage 1: Build the React app
FROM node:20-alpine@sha256:7e89aa6cabfc80f566b1b77b981f4bb98413bd2d513ca9a30f63fe58b4af6903 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build args passed at Docker build time so Vite can embed them
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_BASE_URL
ARG VITE_API_KEY
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_KEY=$VITE_API_KEY

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine@sha256:42d1d5b07c84257b55d409f4e6e3be3b55d42867afce975a5648a3f231bf7e81

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
