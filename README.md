# Payment Idempotency Challenge

## Visão geral

Este projeto demonstra um fluxo de pagamentos idempotente com concorrência segura.

Stack principal:

- backend em Node.js, TypeScript e Express
- PostgreSQL como fonte de verdade
- frontend em React, Vite, Tailwind CSS e componentes no padrão shadcn/ui
- frontend hospedado na Vercel
- backend e PostgreSQL hospedados no Render
- Neon como opção para Postgres em nuvem

O objetivo central é garantir que múltiplas tentativas com a mesma `Idempotency-Key` retornem exatamente a mesma resposta persistida, sem processamento duplicado.

Para uma visão executiva ainda mais curta, consulte [docs/SUMMARY.md](docs/SUMMARY.md).
Para testar a API via Postman, importe [docs/postman_collection.json](docs/postman_collection.json).

## Como rodar localmente

Instale as dependências:

```bash
pnpm install
```

Suba banco, backend e frontend com um único comando:

```bash
pnpm dev:full
```

Esse fluxo:

- sobe o PostgreSQL local no Docker
- aguarda o banco ficar pronto
- aplica as migrations
- inicia backend e frontend em paralelo

Atalhos úteis:

```bash
pnpm dev
pnpm backend
pnpm frontend
pnpm db:setup
pnpm db:down
pnpm db:logs
pnpm lint
```

Endereços locais:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/docs`
- Postman Collection: `docs/postman_collection.json`

Health check:

```bash
curl http://localhost:3000/health
```

## Como avaliar rapidamente

Se o objetivo for validar o projeto com o menor esforço possível, este é o roteiro mais direto:

1. rodar `pnpm dev:full`
2. abrir `http://localhost:5173` para testar a interface
3. abrir `http://localhost:3000/docs` para conferir o contrato da API
4. rodar `pnpm test:integration` para validar a prova forte de idempotência e concorrência

Os pontos principais a observar são:

- a mesma `Idempotency-Key` sempre reaproveita o mesmo resultado persistido
- requests concorrentes com a mesma chave não duplicam processamento
- sucesso e falha são persistidos e reaproveitados
- `200` representa `SUCCESS` persistido, `503` representa `FAILED` persistido e `202` representa `PENDING` transitório

## Como configurar Neon

O deploy principal recomendado para este teste continua sendo Render para backend e Postgres, mas Neon pode ser usado sem mudar a lógica da aplicação.

Exemplo de configuração:

```env
DATABASE_URL=postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require
FRONTEND_URL=https://seu-frontend.vercel.app
PORT=3000
NODE_ENV=production
```

Cuidados com Neon:

- Neon já usa pooling no lado deles com PgBouncer
- evite adicionar uma camada extra de pooling agressivo na aplicação
- para este projeto, a configuração simples com `pg` é suficiente
- em cenários que exigem semântica de sessão, prefira avaliar conexão direta em vez de “double pooling”

## Exemplos de uso

Criar um pagamento:

```bash
curl -i -X POST http://localhost:3000/payments \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: payment-001' \
  -d '{"amount":100,"customerId":"customer-1"}'
```

Repetir a mesma request com a mesma chave:

```bash
curl -i -X POST http://localhost:3000/payments \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: payment-001' \
  -d '{"amount":100,"customerId":"customer-1"}'
```

Simular concorrência local:

```bash
(
  curl -s -X POST http://localhost:3000/payments \
    -H 'Content-Type: application/json' \
    -H 'Idempotency-Key: payment-concurrent-1' \
    -d '{"amount":100,"customerId":"customer-1"}'
) & (
  curl -s -X POST http://localhost:3000/payments \
    -H 'Content-Type: application/json' \
    -H 'Idempotency-Key: payment-concurrent-1' \
    -d '{"amount":100,"customerId":"customer-1"}'
)
wait
```

Contrato esperado:

- `200` para `SUCCESS` persistido
- `503` para `FAILED` persistido
- `202` quando a chave já existe, o registro ainda está em `PENDING` e o polling curto não encontrou estado final

## Testes

Unitários:

```bash
pnpm test:unit
```

Integração com PostgreSQL real:

```bash
pnpm test:integration
```

Os testes de integração:

- usam PostgreSQL real via `TEST_DATABASE_URL`
- verificam estado persistido no banco
- provam que apenas uma request vence o processamento
- cobrem retry após sucesso, retry após falha e comportamento durante `PENDING`

Verificação estática:

```bash
pnpm lint
```

## Deploy

Estratégia enxuta recomendada:

- Vercel para `frontend/`
- Render Web Service para `backend/`
- Render PostgreSQL para `DATABASE_URL`

Configuração mínima:

- Vercel
  - Root Directory: `frontend`
  - Build Command: `pnpm build`
- Render
  - Root Directory: `backend`
  - Build Command: `pnpm install --frozen-lockfile && pnpm build`
  - Start Command: `pnpm start`
  - Health Check Path: `/health`

Documentação da API:

- `GET /docs`
- Postman Collection: `docs/postman_collection.json`

## Trade-offs

Decisões intencionais desta solução:

- PostgreSQL como fonte de verdade, não Redis
- sem lock distribuído explícito
- sem fila ou worker separado
- frontend simples, focado em demonstrar o comportamento do backend

Trade-offs aceitos:

- polling curto em vez de mecanismo mais sofisticado de notificação
- `503` para falha persistida, mantendo o replay exato do status HTTP e do body final salvo
- setup de deploy manual via painel, sem automação extra

## Melhorias futuras

- retenção de `Idempotency-Key` por janela configurável, por exemplo `24h`
- rejeição explícita e auditável para payload divergente com mesma chave
- CI para build, lint e testes
- observabilidade mais forte em produção
- fila ou worker separado apenas se houver necessidade real de throughput ou integração externa
