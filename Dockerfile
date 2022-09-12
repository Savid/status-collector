FROM node:18.9.0-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY ./dist/ ./dist

RUN npm ci --omit=dev

CMD [ "node", "--enable-source-maps", "-r", "dotenv/config", "./dist/index.js" ]
