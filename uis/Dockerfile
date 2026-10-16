FROM node:24.18.1-alpine

WORKDIR /workspace/uis

RUN apk add --no-cache libc6-compat

COPY website/package.json website/package-lock.json ./website/
COPY backoffice/package.json backoffice/package-lock.json ./backoffice/

RUN npm --prefix website ci \
    && npm --prefix backoffice ci

COPY website ./website
COPY backoffice ./backoffice
COPY start.sh start-frontends.mjs ./

EXPOSE 3000 3001

CMD ["sh", "/workspace/uis/start.sh"]
