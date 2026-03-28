# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Create app directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY server.js ./
COPY public ./public

# Environment
ENV NODE_ENV=production \
    PORT=3000 \
    API_BASE=https://api.esimaccess.com/api/v1/open

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
