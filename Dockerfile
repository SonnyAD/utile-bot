FROM alpine AS build-env

RUN apk update 
RUN apk add autoconf automake libtool git make
RUN apk add gcc zlib g++

RUN git clone https://github.com/jb55/nostril

RUN cd nostril \
  && make \
  && make install

FROM node:16-alpine

COPY --from=build-env /usr/local/bin /usr/local/bin

RUN mkdir /app
WORKDIR /app

COPY *.json ./
RUN npm ci 

COPY bot.js .
COPY nostr /usr/bin/nostr

RUN apk update && apk add --no-cache websocat

ENV NOSTR_PRIVKEY $NOSTR_PRIVKEY

CMD ["npm", "run", "start"]