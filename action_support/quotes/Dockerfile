FROM node:24-alpine

WORKDIR /app
RUN apk add --no-cache git
RUN git clone https://github.com/Armanidrisi/quote-generator-api.git

WORKDIR /app/quote-generator-api
RUN npm install

EXPOSE 3000

CMD ["npm", "start"]
