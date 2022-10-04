FROM node:18.7.0

ENV NODE_ENV=production

WORKDIR /app

COPY . /app

RUN npm install

RUN npx tsc --project tsconfig.json

CMD node ./build/src/index.js