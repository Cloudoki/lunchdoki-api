FROM node:10.16.0-alpine

RUN apk update

WORKDIR /lunchdoki

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "start"]

