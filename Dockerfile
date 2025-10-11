FROM node:18-alpine
WORKDIR /app

RUN apk add --no-cache bash curl python3 make g++ build-base

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=development
ENV PORT=5001
EXPOSE 5001

CMD ["npm", "start"]
