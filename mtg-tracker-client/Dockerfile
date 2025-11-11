# Stage 1: Build the Next.js application
FROM node:20-alpine

COPY package.json .
RUN yarn install
COPY . .
CMD ["npm", "run", "dev"]

