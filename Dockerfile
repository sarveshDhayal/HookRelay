FROM node:20-alpine

WORKDIR /app

# Install dependencies for server
COPY package*.json ./
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Build dashboard frontend
COPY dashboard/package*.json ./dashboard/
RUN cd dashboard && npm install

COPY dashboard ./dashboard/
RUN cd dashboard && npm run build

# Copy remaining source code
COPY src ./src/
COPY docs ./docs/

EXPOSE 4000

# Push DB schema, seed demo data if empty, and start server
CMD ["sh", "-c", "npx prisma db push && npm run prisma:seed && node src/server.js"]
