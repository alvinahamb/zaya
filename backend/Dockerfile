# syntax=docker/dockerfile:1

# Debian slim plutôt qu'Alpine : prebuilds glibc disponibles pour bcrypt,
# et openssl requis par Prisma.
FROM node:22-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=development

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4000
# Le client Prisma est généré au démarrage : /app est bind-monté, ce qui
# masquerait un client généré à la construction de l'image.
CMD ["sh", "-c", "npx prisma generate && npm run dev"]
