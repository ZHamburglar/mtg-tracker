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

# Make sure production dependencies are installed
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/.next ./ .next
COPY --from=builder /app/public ./public
# COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/package*.json ./

# Expose port
EXPOSE 3000

# Start the Next.js server
CMD ["npm", "start"]