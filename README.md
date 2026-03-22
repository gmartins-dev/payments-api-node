# Payment Idempotency Challenge

## Visão geral

Este repositório foi planejado como um monorepo para demonstrar um fluxo de pagamentos com idempotência e concorrência corretas.

A proposta é manter:

- `backend/` com a API
- `frontend/` com a interface de demonstração
- PostgreSQL como fonte de verdade
- Redis apenas como melhoria opcional

O ponto central da solução é garantir que múltiplas tentativas com a mesma `Idempotency-Key` retornem sempre o mesmo resultado persistido, sem processamento duplicado.

## Estrutura esperada

```text
.
├── backend/
├── frontend/
├── ARCHITECTURE.md
└── README.md
```

## Como colocar no ar gratuitamente

A combinação mais pragmática para este projeto é:

- frontend na Vercel
- backend no Render
- banco PostgreSQL no Render

Mesmo usando hosts diferentes, o projeto continua sendo um monorepo. O deploy é separado por pasta, não por repositório.

## Estratégia de deploy

### Frontend

Hospedar o frontend na Vercel:

1. conectar este repositório à Vercel
2. criar um projeto apontando para `frontend/`
3. definir `frontend/` como `Root Directory`
4. configurar `VITE_API_URL` com a URL pública do backend

### Backend

Hospedar o backend no Render:

1. conectar este repositório ao Render
2. criar um Web Service apontando para `backend/`
3. configurar `DATABASE_URL` com a string de conexão do Postgres do próprio Render
4. publicar o serviço HTTP

### Banco

Hospedar o banco no Render:

1. criar um PostgreSQL no Render
2. obter a `DATABASE_URL`
3. executar as migrations no banco remoto
4. conectar o backend ao banco

## Variáveis de ambiente esperadas

### Frontend

```env
VITE_API_URL=https://seu-backend.onrender.com
```

### Backend

```env
PORT=3000
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
REDIS_URL=redis://localhost:6379
```

`REDIS_URL` pode ser opcional se Redis não fizer parte da primeira versão em produção.

## Modelagem atual do banco

Na Sprint 2, a base de persistência foi definida com:

- enum `payment_status` com `PENDING`, `SUCCESS` e `FAILED`
- tabela `payments`
- `UNIQUE(idempotency_key)` como mecanismo central de deduplicação
- índice por `status`
- índice por `customer_id`

Os arquivos SQL de migração ficam em:

- `backend/src/migrations/001_create_payments.sql`
- `backend/src/migrations/002_add_payments_updated_at_trigger.sql`

Nesta etapa, `updated_at` fica garantido por trigger no banco. Isso reduz o risco de inconsistência entre diferentes caminhos de escrita.

## Como rodar localmente

Instalar as dependências:

```bash
pnpm install
```

Subir frontend e backend juntos:

```bash
pnpm dev
```

Subir apenas o backend:

```bash
pnpm backend
```

Subir apenas o frontend:

```bash
pnpm frontend
```

Endereços esperados:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`

Teste rápido do backend:

```bash
curl http://localhost:3000/health
```

Resposta esperada:

```json
{"status":"ok"}
```

Teste rápido do módulo de pagamentos:

```bash
curl -i -X POST http://localhost:3000/payments \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: setup-check' \
  -d '{"amount":100,"customerId":"customer-1"}'
```

Resposta esperada no estado atual:

- status `501 Not Implemented`
- corpo JSON controlado pela camada `payments`
- validação de body e header já conectada

Comandos úteis:

```bash
pnpm build
pnpm test
```

## Por que Render vale a pena neste teste

Para um desafio curto, Render com backend e Postgres no mesmo provedor traz vantagens claras:

- setup mais simples
- menos pontos de configuração
- deploy mais rápido
- mais tempo para focar em idempotência, concorrência e testes

## Limitações que não atrapalham o teste

É importante saber que o plano gratuito pode ter restrições de disponibilidade, performance e durabilidade maiores do que um ambiente mais robusto.

No caso do Postgres gratuito do Render:

- ele expira 30 dias após a criação
- não oferece backups
- pode sofrer reinícios e indisponibilidades ocasionais de manutenção

Para este desafio, isso não muda a decisão principal, porque o objetivo é demonstrar a solução funcionando com clareza e rapidez.

Uma forma madura de documentar isso é registrar no README algo como:

> Este projeto usa o PostgreSQL gratuito do Render por simplicidade e velocidade de entrega. Esse banco expira após 30 dias e não possui backups. Em um ambiente de produção, o ideal é usar uma instância persistente.

## Próximos passos sugeridos

1. modelagem do banco e migrations
2. implementação do `POST /payments`
3. testes de concorrência
4. integração entre frontend e backend
5. deploy do frontend na Vercel
6. deploy do backend e banco no Render

## Documentos do repositório

- `ARCHITECTURE.md`: visão arquitetural e decisões principais

## Status atual

Neste momento, o repositório já possui o setup inicial funcional de frontend e backend, além da documentação-base para continuar a implementação e preparar o deploy em monorepo com frontend na Vercel e backend + banco no Render.

No backend, a fase inicial de scaffold já inclui:

- `GET /health`
- módulo `payments` conectado por rota, controller, service, repository, schemas e processor
- validação inicial com `zod`
- request context
- error handler centralizado
- logging HTTP com `pino-http`
