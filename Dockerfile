FROM node:alpine

ENV NODE_ENV=production

# Copy accross our dependencies
COPY package*.json /tmp/
RUN cd /tmp && npm install

WORKDIR /app

COPY . /app

RUN cp -r /tmp/node_modules/. /app/node_modules/

RUN npx tsc --project tsconfig.json

CMD node ./build/src/main.js