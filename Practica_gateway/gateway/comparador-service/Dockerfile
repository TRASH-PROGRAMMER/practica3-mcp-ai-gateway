FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# install full deps so Nest CLI and libs are available for build
COPY package*.json ./
RUN npm install

# copy and build
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /usr/src/app

# copy only built files and production deps
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3002
CMD ["node", "dist/main.js"]
