# Frontend dockerfile
FROM node:20

WORKDIR /app

# Install deps first
COPY package*.json ./
RUN npm install

# Copy app (no prefix needed, context is already ./crypto-dashboard)
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
