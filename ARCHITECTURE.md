# Arquitetura do Projeto

## Visão geral

Este projeto foi pensado como um monorepo fullstack com dois aplicativos principais:

- `backend/`: API de pagamentos idempotentes em Node.js, TypeScript e Express
- `frontend/`: interface de demonstração em React, Vite, Tailwind e shadcn/ui

Além disso, a raiz do repositório concentra a documentação:

- `README.md`
- `ARCHITECTURE.md`

O objetivo técnico principal é demonstrar idempotência e concorrência corretas em pagamentos, com PostgreSQL como fonte de verdade.

## Decisão de arquitetura

A arquitetura recomendada para este teste é:

- frontend hospedado na Vercel
- backend hospedado no Render como Web Service
- banco PostgreSQL hospedado no Render

Mesmo com frontend e backend em hosts diferentes, o projeto continua sendo um monorepo. Não é necessário separar em dois repositórios.

Estrutura esperada:

```text
payments-idempotency/
  backend/
  frontend/
  ARCHITECTURE.md
  README.md
```

## Fonte de verdade da idempotência

A garantia principal de idempotência e concorrência deve ficar no PostgreSQL, não em memória e não somente no Redis.

A estratégia base é:

- persistir um registro por `Idempotency-Key`
- aplicar `UNIQUE(idempotency_key)`
- tentar `INSERT ... ON CONFLICT DO NOTHING RETURNING *`
- a request que inserir com sucesso é a dona do processamento
- requests concorrentes com a mesma chave reutilizam o estado persistido

Essa abordagem garante:

- ausência de processamento duplicado para a mesma chave
- replay da mesma resposta final em retries
- consistência mesmo sob concorrência real entre requests

## Fluxo do backend

Fluxo esperado do `POST /payments`:

1. validar body e header `Idempotency-Key`
2. tentar inserir o pagamento com status `PENDING`
3. se inseriu, processar
4. persistir `SUCCESS` ou `FAILED`, incluindo `response_status_code` e `response_body`
5. se não inseriu, buscar o registro já existente
6. se já estiver finalizado, retornar exatamente a resposta persistida
7. se ainda estiver `PENDING`, fazer polling curto e depois retornar resultado final ou `202`

## Papel do Redis

Redis pode existir como melhoria opcional, mas não como base da correção.

Usos aceitáveis:

- cache curto por chave de idempotência
- sinalização leve de conclusão
- melhorias futuras de coordenação

Usos que devem ser evitados como base principal:

- lock distribuído como garantia principal
- deduplicação sem persistência no banco

## Deploy em monorepo

O formato recomendado de publicação para este teste é:

- `frontend` na Vercel
- `backend` no Render como Web Service
- PostgreSQL no Render

Essa abordagem reduz a configuração ao mínimo onde realmente importa e mantém backend e banco no mesmo provedor, o que ajuda bastante em um desafio curto.

### Frontend na Vercel

Na Vercel, a configuração recomendada é:

- conectar o mesmo repositório Git
- criar um projeto para o frontend
- definir `frontend/` como `Root Directory`
- configurar a variável `VITE_API_URL` com a URL pública do backend

Não é obrigatório criar `vercel.json` na raiz para esse fluxo. O caminho mais simples é configurar o diretório do frontend diretamente no painel da Vercel.

### Backend no Render

No Render, a configuração recomendada é:

- conectar o mesmo repositório Git
- criar um Web Service para o backend
- apontar o serviço para a pasta `backend/`
- configurar `DATABASE_URL` com a conexão do Postgres do próprio Render
- publicar a API como serviço HTTP separado

### PostgreSQL no Render

Para este teste, usar o Postgres do próprio Render vale a pena porque:

- o setup é mais rápido
- há menos chance de erro de configuração
- backend e banco ficam integrados no mesmo provedor
- sobra mais tempo para focar no core de idempotência

As limitações do plano gratuito não comprometem a proposta do desafio, desde que o objetivo seja a entrega e a demonstração do projeto.

Pontos que devem ser documentados com transparência:

- o Postgres gratuito do Render expira 30 dias após a criação
- após expirar, há um período de graça antes da exclusão definitiva
- o plano gratuito não oferece backups

## Comunicação entre frontend e backend

Como os serviços ficam em hosts diferentes, o frontend deve consumir a API por URL pública configurada em variável de ambiente.

Exemplo:

```env
VITE_API_URL=https://seu-backend.onrender.com
```

A aplicação frontend não precisa compartilhar processo nem host com o backend. O que precisa existir é:

- URL pública do backend
- CORS configurado corretamente
- contrato HTTP estável

## Vantagens de manter monorepo

Para este desafio, o monorepo é a melhor escolha porque:

- mantém backend e frontend no mesmo contexto
- centraliza documentação e decisões técnicas
- facilita a avaliação do projeto como entrega única
- evita custo operacional de manter múltiplos repositórios

## Tradeoffs da abordagem

Vantagens:

- setup muito simples
- menos configuração entre provedores
- deploy independente por subdiretório
- entrega mais rápida

Tradeoffs:

- plano gratuito com mais limitações
- banco menos durável como solução de portfólio de longo prazo
- necessidade de configurar Vercel e Render separadamente

## Evolução futura

Se o projeto crescer, evoluções naturais seriam:

- pipeline CI para testes e validações
- deploy preview por branch
- domínio customizado
- observabilidade mais forte
- fila ou worker separado, se houver requisito real

Nenhuma dessas evoluções é necessária para a primeira versão do desafio.
