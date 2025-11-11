FROM node:alpine
 
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
# RUN npm install
COPY . .
 
CMD ["npm", "run", "start"]