FROM node:24-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:24-slim AS builder
WORKDIR /app
# Les variables NEXT_PUBLIC_* sont inlinées dans le JavaScript envoyé au
# navigateur au moment du build (next build), pas lues au runtime du
# conteneur — contrairement aux autres variables d'environnement du projet.
# Sans ce build-arg, le code retombe sur son fallback de développement
# (http://localhost:4000, voir apps/web/lib/useApiFetch.js), gravé en dur
# dans le bundle final, indépendamment du .env du serveur de production.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
