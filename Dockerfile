FROM node:15.7.0-alpine

# Create app directory.
WORKDIR /usr/src/app

# Install app dependencies.
COPY package*.json ./
RUN npm install

# Bundle app source.
COPY . .

# Expose 8080 port.
EXPOSE 8080

# Start express node server.
CMD [ "npm", "run", "start:server" ]
