FROM node:20-slim

WORKDIR /app

# Install dependencies first for efficient layer caching
COPY package*.json ./
COPY packages/contract/package*.json ./packages/contract/
COPY backend/agent/package*.json ./backend/agent/
COPY backend/gateway/package*.json ./backend/gateway/
COPY web/package*.json ./web/

RUN npm install

# Copy application source code
COPY . .

# Build all monorepo packages (contract, gateway, agent, web)
RUN npm run build

# Default exposed port for Gateway
ENV PORT=8787
EXPOSE 8787

# Launch all production backend services via the supervisor
CMD ["node", "backend/server.mjs"]
