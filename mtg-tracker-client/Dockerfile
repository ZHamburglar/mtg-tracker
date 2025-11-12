# Stage 1: Build the Next.js application
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy rest of the source
COPY . .

# Build Next.js app
RUN npm run build

# Stage 2: Run the Next.js production server
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy the standalone build from builder (includes everything needed)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Start the Next.js server
CMD ["node", "server.js"]