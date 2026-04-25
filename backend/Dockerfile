# Use a Node.js base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source and build
COPY backend/src ./src
RUN npm run build

# Set environment
ENV PORT=3001

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "dist/index.js"]