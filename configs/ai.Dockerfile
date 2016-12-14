FROM node:0.12
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY ./server ./server
COPY ./ai ./ai
COPY ./client ./client
RUN cd server && npm install && cd ../ai && npm install && cd ..
ENV NODE_ENV production
CMD ["node", "--harmony", "ai/ai.js"]