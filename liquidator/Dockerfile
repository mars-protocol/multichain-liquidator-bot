FROM node:12.18.1

ENV NODE_ENV=production

WORKDIR /app

COPY . /app

RUN npm install

RUN npx tsc

CMD node src/index.js