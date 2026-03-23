# Deploy

## Objetivo

Este guia coloca o projeto no ar para uma demonstração real online usando:

- `frontend` na Vercel
- `backend` no Render
- `PostgreSQL` no Render ou Neon

O caminho abaixo é o mais direto e compatível com a estrutura atual do repositório.

## Arquitetura final

- frontend: `https://seu-frontend.vercel.app`
- backend: `https://seu-backend.onrender.com`
- Swagger: `https://seu-backend.onrender.com/docs`
- health check: `https://seu-backend.onrender.com/health`
- banco: Render Postgres ou Neon

## Pré-requisitos

- conta na Vercel
- conta no Render
- repositório publicado no GitHub
- Node `24+`
- `pnpm` instalado localmente

## Variáveis de ambiente

### Backend

Baseado em [backend/.env.example](/home/gmartinsdev/dev/repos/payments-api-node/backend/.env.example):

```env
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://seu-frontend.vercel.app
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Observações:

- `FRONTEND_URL` precisa ser exatamente a URL pública do frontend
- se usar Neon, normalmente a `DATABASE_URL` deve incluir `?sslmode=require`

Exemplo com Neon:

```env
DATABASE_URL=postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require
```

### Frontend

Baseado em [frontend/.env.example](/home/gmartinsdev/dev/repos/payments-api-node/frontend/.env.example):

```env
VITE_API_URL=https://seu-backend.onrender.com
```

## Passo 1. Validar o projeto localmente

Na raiz do repositório:

```bash
pnpm install
pnpm lint
pnpm --filter backend test
pnpm --filter frontend build
```

Se quiser validar o fluxo completo local antes do deploy:

```bash
pnpm dev:full
```

## Passo 2. Criar o banco de dados

### Opção A. Render Postgres

No Render:

1. Acesse `New +`.
2. Crie um `PostgreSQL`.
3. Dê um nome como `payments-db`.
4. Aguarde a criação.
5. Copie a connection string.

### Opção B. Neon

No Neon:

1. Crie um projeto.
2. Crie um banco.
3. Copie a connection string.
4. Garanta que ela tenha `sslmode=require`.

## Passo 3. Criar o backend no Render

No Render:

1. Acesse `New +`.
2. Crie um `Web Service`.
3. Conecte o repositório.
4. Configure:

- Name: `payments-backend`
- Root Directory: `backend`
- Runtime: `Node`
- Build Command:

```bash
pnpm install --frozen-lockfile && pnpm build
```

- Start Command:

```bash
pnpm start
```

- Health Check Path:

```text
/health
```

## Passo 4. Configurar as variáveis do backend no Render

Adicione:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://...
FRONTEND_URL=https://seu-frontend.vercel.app
```

Importante:

- neste momento você ainda pode não ter a URL final da Vercel
- se isso acontecer, publique primeiro o frontend e depois volte para ajustar `FRONTEND_URL`

## Passo 5. Rodar as migrations

O projeto tem migration script em [backend/scripts/migrate.ts](/home/gmartinsdev/dev/repos/payments-api-node/backend/scripts/migrate.ts).

Você precisa rodar isso no ambiente de produção.

### Opção recomendada

No Render, configure:

- Pre-Deploy Command:

```bash
pnpm db:migrate
```

### Opção manual

Se preferir, abra o shell do serviço e rode:

```bash
pnpm db:migrate
```

Sem essa etapa, a aplicação sobe mas o banco não terá a estrutura necessária.

## Passo 6. Confirmar que o backend está saudável

Depois do deploy do backend, valide:

```bash
curl https://seu-backend.onrender.com/health
```

Abra também:

- `https://seu-backend.onrender.com/docs`

Se falhar:

- revise `DATABASE_URL`
- confirme se as migrations rodaram
- verifique os logs do Render

## Passo 7. Criar o frontend na Vercel

Na Vercel:

1. Crie um novo projeto.
2. Selecione o mesmo repositório.
3. Configure:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command:

```bash
pnpm build
```

- Output Directory:

```text
dist
```

## Passo 8. Configurar as variáveis do frontend na Vercel

Adicione:

```env
VITE_API_URL=https://seu-backend.onrender.com
```

Depois publique o frontend.

## Passo 9. Ajustar o CORS do backend

Depois que a Vercel gerar a URL final do frontend, volte no Render e atualize:

```env
FRONTEND_URL=https://seu-frontend.vercel.app
```

Depois faça um novo deploy do backend.

Isso é obrigatório porque o backend usa `FRONTEND_URL` no CORS.

## Passo 10. Validar o fluxo fim a fim online

Abra o frontend publicado e teste:

1. criar um pagamento
2. repetir a mesma chave
3. simular concorrência
4. abrir o Swagger
5. observar `SUCCESS`, `FAILED` e `PENDING`

Também vale testar direto via `curl`:

```bash
curl -i -X POST https://seu-backend.onrender.com/payments \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: payment-001' \
  -d '{"amount":100,"customerId":"customer-1"}'
```

Repita exatamente a mesma chamada com a mesma chave para validar o replay persistido.

## Checklist final

- `backend` responde em `/health`
- Swagger abre em `/docs`
- migrations aplicadas com sucesso
- `DATABASE_URL` aponta para o banco real
- `FRONTEND_URL` aponta para a URL real da Vercel
- `VITE_API_URL` aponta para a URL real do backend
- frontend consegue chamar backend sem erro de CORS
- banco é persistente
- logs do Render não mostram erro de conexão

## Configuração final para copiar e colar

### Backend no Render

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/dbname
FRONTEND_URL=https://seu-frontend.vercel.app
```

### Frontend na Vercel

```env
VITE_API_URL=https://seu-backend.onrender.com
```

## Problemas comuns

### O frontend chama `localhost`

Causa:

- `VITE_API_URL` não foi configurada corretamente

Correção:

- ajuste a variável na Vercel
- gere novo deploy do frontend

### Erro de CORS

Causa:

- `FRONTEND_URL` do backend não bate com a URL real do frontend

Correção:

- ajuste a variável no Render
- faça novo deploy do backend

### Backend sobe, mas falha ao processar requisições

Causa comum:

- migrations não foram aplicadas

Correção:

- rode `pnpm db:migrate` no ambiente do backend

### Falha de conexão com banco em Neon

Causa comum:

- connection string sem `sslmode=require`

Correção:

- ajuste a `DATABASE_URL`

### Deploy falha no build

Causas comuns:

- versão de Node incompatível
- lockfile inconsistente
- variáveis ausentes

Correção:

- garanta Node `24+`
- use `pnpm install --frozen-lockfile`
- revise todas as variáveis

## Estratégia recomendada para demo

Se o objetivo é ter uma demonstração online rápida, estável e fácil de explicar:

- frontend na Vercel
- backend no Render
- Postgres no Render

Essa combinação é a mais simples para este projeto hoje.
