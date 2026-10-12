FROM node:22-alpine
WORKDIR /e2e
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
USER node
ENTRYPOINT ["node", "--test", "--test-concurrency=1"]
