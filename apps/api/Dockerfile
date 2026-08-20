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

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV NODE_ENV=production
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

# Utilisateur non-root — Chromium a besoin d'écrire dans son propre HOME
# (cache, profil temporaire) au moment du rendu PDF : sans ce HOME
# explicite et accessible en écriture par cet utilisateur, la génération
# du kit de communication échouerait silencieusement. /app appartient
# aussi à cet utilisateur, npm ayant déjà tout installé en tant que root
# à l'étape précédente.
RUN addgroup -S apiuser && adduser -S apiuser -G apiuser -h /home/apiuser \
    && mkdir -p /home/apiuser && chown -R apiuser:apiuser /home/apiuser /app
ENV HOME=/home/apiuser
USER apiuser

EXPOSE 4000
CMD ["node", "src/index.js"]
