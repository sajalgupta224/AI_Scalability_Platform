# ==============================
# Dockerfile for Node.js Backend
# ==============================

# Use lightweight Node base image
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install backend dependecies
RUN npm install

# Copy backend code
COPY . .

# Expose backend port
EXPOSE 5000