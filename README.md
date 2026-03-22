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

## Regra atual de idempotência

O fluxo atual de `POST /payments` funciona assim:

- a primeira tentativa com uma nova `Idempotency-Key` cria um registro `PENDING`
- a request que conseguiu inserir o registro é a dona do processamento
- ao concluir, a API persiste exatamente o `response_status_code` e o `response_body`
- retries com a mesma chave reutilizam a resposta persistida
- se outra request encontrar o registro em `PENDING`, ela faz polling no banco a cada `100ms` por até `3s`
- se o estado final aparecer dentro desse intervalo, a mesma resposta persistida é devolvida
- se continuar `PENDING`, a API responde `202`

Contrato atual:

- `200` para respostas persistidas finais, incluindo sucesso e falha
- `202` para pendência após timeout de polling

Nota de produção:

- o reuso da mesma `Idempotency-Key` com payload diferente deve ser rejeitado
- uma janela de retenção da chave, por exemplo `24h`, pode ser aplicada em ambiente produtivo

## Processador simulado

O backend agora usa um processador simulado para demonstrar comportamento assíncrono e falha intermitente.

Comportamento padrão:

- delay variável entre `1500ms` e `4000ms`
- probabilidade de falha de `30%`
- sucesso retorna:
  - `paymentId`
  - `status: "SUCCESS"`
  - `amount`
  - `customerId`
- falha lança um erro tipado com motivo `PROCESSOR_TEMPORARY_ERROR`

O módulo foi preparado para testes determinísticos por configuração de:

- faixa de delay
- taxa de falha
- função aleatória
- função de espera

## Testes automatizados

O backend agora possui cobertura automatizada para os cenários centrais de idempotência e concorrência.

Cenários cobertos:

- criação de novo pagamento com sucesso
- retry com a mesma `Idempotency-Key` reaproveitando a mesma resposta persistida de sucesso
- retry com a mesma `Idempotency-Key` reaproveitando a mesma resposta persistida de falha
- múltiplas requests concorrentes com a mesma chave sem duplicar linha nem processamento
- request chegando durante `PENDING`, retornando resultado final persistido ou `202` consistente

Estratégia atual de teste:

- Vitest + Supertest para testes HTTP
- banco de teste PostgreSQL real apontado por `TEST_DATABASE_URL`
- isolamento por schema efêmero para cada execução de integração
- processador injetável e controlado manualmente nos cenários críticos de concorrência e `PENDING`

Esses testes verificam tanto o contrato HTTP quanto o estado persistido no banco.

## Observabilidade

O backend usa:

- `pino` como logger base
- `pino-http` para logs por request
- `requestId` em `res.locals` e no header `X-Request-Id`
- `idempotencyKey` anexada ao contexto sempre que presente

Isso permite correlacionar:

- request recebida
- processamento da rota
- erro tratado
- resposta final

## Como rodar localmente

Instalar as dependências:

```bash
pnpm install
```

Subir o PostgreSQL local para desenvolvimento e testes:

```bash
pnpm db:setup
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

- status `200 OK`
- corpo persistido com `paymentId`, `status`, `amount` e `customerId`
- reuso da mesma `Idempotency-Key` devolve a mesma resposta persistida

Comandos úteis:

```bash
pnpm build
pnpm test
pnpm test:unit
pnpm test:integration
```

Convenção atual:

- `pnpm test` roda a suíte unitária do backend
- `pnpm test:integration` roda a prova forte de Sprint 6 contra PostgreSQL real

Comandos auxiliares do banco local:

- `pnpm db:up` sobe o Postgres local via Docker
- `pnpm db:wait` aguarda o Postgres ficar pronto para conexões
- `pnpm db:setup` sobe o banco, aguarda readiness e aplica as migrations
- `pnpm db:down` derruba o Postgres local e remove o volume
- `pnpm db:logs` acompanha os logs do container
- `pnpm db:migrate` aplica as migrations em `DATABASE_URL`
- `pnpm db:migrate:test` aplica as migrations no banco `payments_test`

Para rodar os testes de integração com prova real de concorrência, defina `TEST_DATABASE_URL` para um PostgreSQL acessível:

```bash
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/payments_test
pnpm test:integration
```

Sem `TEST_DATABASE_URL`, apenas os testes unitários devem ser considerados executáveis no ambiente local.

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
