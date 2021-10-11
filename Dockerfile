FROM node:12-alpine

RUN mkdir /app
WORKDIR /app

COPY *.json ./
RUN npm ci 

COPY bot.js .

CMD ["npm", "run", "start"]