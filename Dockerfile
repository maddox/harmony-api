FROM node:argon

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app
RUN npm install

COPY . /usr/src/app

EXPOSE 8282
CMD [ "npm", "start" ]
