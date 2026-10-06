# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port (Fly.io uses 8080)
EXPOSE 8080

# Start the application
CMD ["npm", "start"]