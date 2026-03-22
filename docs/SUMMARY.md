# Resumo Executivo

## O que este projeto demonstra

Este repositório implementa um fluxo de pagamentos idempotente com concorrência segura.

As garantias centrais são:

- a mesma `Idempotency-Key` sempre reaproveita o mesmo resultado persistido
- apenas uma request processa de fato cada chave
- retries e concorrência nunca geram processamento duplicado
- o PostgreSQL é a única fonte de verdade da correção

## Decisão técnica principal

A idempotência não depende de memória nem de Redis. O fluxo usa:

- `UNIQUE(idempotency_key)`
- `INSERT ... ON CONFLICT DO NOTHING RETURNING *`
- persistência do `response_status_code` e do `response_body`

Com isso, a primeira request que consegue inserir o `PENDING` vira dona do processamento. As demais apenas consultam e reaproveitam o estado salvo.

## Contrato HTTP

- `200`: `SUCCESS` persistido
- `503`: `FAILED` persistido
- `202`: `PENDING` após polling curto de `100ms` por até `3s`

O ponto importante não é “sempre responder 200”, e sim repetir exatamente o status HTTP e o body finais já persistidos para a mesma chave.

## Como validar rápido

```bash
pnpm install
pnpm dev:full
pnpm test:integration
pnpm lint
```

Depois disso:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`

## O que testar na demonstração

- retries de sucesso e falha reaproveitam o mesmo resultado
- requests concorrentes com a mesma chave não duplicam processamento
- a prova forte de concorrência roda contra PostgreSQL real
- a solução é enxuta, mas cobre observabilidade, documentação e deploy
