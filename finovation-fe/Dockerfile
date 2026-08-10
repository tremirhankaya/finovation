FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm ci
RUN npm install @rolldown/binding-linux-x64-gnu --save-dev

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]