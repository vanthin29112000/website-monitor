# Dockerfile
FROM node:22-bullseye-slim

# Cài Chromium và các thư viện cần thiết
RUN apt-get update && \
    apt-get install -y chromium fonts-liberation libatk1.0-0 libatk-bridge2.0-0 \
       libcups2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
       libpangocairo-1.0-0 libasound2 libnspr4 libnss3 libxss1 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json và cài npm dependencies (bao gồm Puppeteer)
COPY package*.json ./
RUN npm install

# Copy toàn bộ mã nguồn
COPY . .

# Mở cổng ứng dụng
EXPOSE 5000

# Khởi server
CMD ["node", "server.js"]