# Stage 1: Build the Vite demo app
FROM node:20-alpine as builder
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the demo app via our new Vite config
RUN npm run build:demo

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy the built assets to Nginx's web root
COPY --from=builder /app/dist-demo /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
