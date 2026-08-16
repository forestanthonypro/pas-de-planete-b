FROM node:24-alpine
WORKDIR /app

# Chromium système + polices — nécessaire uniquement pour la génération PDF
# du kit de communication (Phase 3), jamais chargé pour le reste de l'API.
# Le binaire Chromium embarqué par défaut dans le paquet npm "playwright"
# est compilé pour glibc et NE FONCTIONNE PAS sur Alpine (musl) — on utilise
# donc "playwright-core" (sans navigateur embarqué, plus léger) pointé vers
# le Chromium installé via apk. ttf-freefont est nécessaire pour un rendu
# correct des accents français dans le PDF.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
ENV NODE_ENV=production
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
EXPOSE 4000
CMD ["node", "src/index.js"]
