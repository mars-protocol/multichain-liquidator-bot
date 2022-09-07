FROM node:18.7.0

ENV NODE_ENV=production

WORKDIR /app

COPY . /app

RUN npm install

RUN npx tsc

CMD node src/index.js