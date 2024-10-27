# Stage 1: Build the application
FROM node:18-alpine AS build

ENV NODE_ENV=production

# Set up working directory
WORKDIR /app

# Install dependencies in a temporary directory
COPY package*.json ./
RUN npm install

# Copy source files and build TypeScript
COPY . .
RUN npx tsc --project tsconfig.json

# Stage 2: Create a clean, minimal image
FROM node:18-alpine

# Set up working directory
WORKDIR /app

# Copy only the compiled files and node_modules from the build stage
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build

# Start the application
CMD ["node", "./build/src/main.js"]