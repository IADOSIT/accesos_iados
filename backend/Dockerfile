FROM node:20-alpine

WORKDIR /app

# Instalar dependencias necesarias para Prisma y node-gyp
RUN apk add --no-cache openssl openssl-dev libc6-compat curl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Generar cliente de Prisma
RUN npx prisma generate

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
