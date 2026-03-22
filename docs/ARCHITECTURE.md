# Arquitetura do Projeto

## Visão geral

Este projeto foi pensado como um monorepo fullstack com dois aplicativos principais:

- `backend/`: API de pagamentos idempotentes em Node.js, TypeScript e Express
- `frontend/`: interface de demonstração em React, Vite, Tailwind e shadcn/ui

Além disso, a raiz do repositório concentra a documentação:

- `README.md`
- `ARCHITECTURE.md`

O objetivo técnico principal é demonstrar idempotência e concorrência corretas em pagamentos, com PostgreSQL como fonte de verdade.

Na camada de apresentação, o frontend precisa ser suficiente para tornar visível o comportamento idempotente do backend, sem desviar o foco para complexidade desnecessária de UI ou estado global.

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
- correção de polling apoiada em read-after-write consistency do PostgreSQL
- ausência de eventual consistency no fluxo crítico, porque todas as transições ficam no mesmo banco

## Modelagem da persistência

O modelo inicial do banco usa:

- enum `payment_status`
- tabela `payments`
- `UNIQUE(idempotency_key)`
- índice por `status`
- índice por `customer_id`

Além disso, a coluna `updated_at` existe desde a primeira migration e é mantida por trigger no banco. Isso reduz risco de inconsistência entre caminhos de escrita e mantém a atualização de timestamp protegida no nível da persistência.

## Fluxo do backend

Fluxo esperado do `POST /payments`:

1. validar body e header `Idempotency-Key`
2. tentar inserir o pagamento com status `PENDING`
3. se inseriu, processar
4. persistir `SUCCESS` ou `FAILED`, incluindo `response_status_code` e `response_body`
5. se não inseriu, buscar o registro já existente
6. se já estiver finalizado, retornar exatamente a resposta persistida
7. se ainda estiver `PENDING`, fazer polling curto e depois retornar resultado final ou `202`

Detalhes explícitos da implementação:

- polling a cada `100ms`
- timeout máximo de `3s`
- `200` para `SUCCESS` e `FAILED`
- `202` para `PENDING` após timeout

Nota de produção:

- reuso da mesma `Idempotency-Key` com payload divergente deve ser rejeitado
- uma janela de retenção da chave, por exemplo `24h`, pode ser aplicada fora do escopo do MVP

## Processador simulado

Para demonstrar o fluxo de pagamento sem depender de um provedor externo real, o projeto usa um processador simulado com:

- tempo variável entre `1500ms` e `4000ms`
- chance de falha configurável, com padrão de `30%`
- erro tipado para falha temporária do processador

Esse desenho permite:

- demonstrar o comportamento de `PENDING`
- provar replay de sucesso e falha
- manter previsibilidade em testes por meio de injeção de configuração

## Observabilidade e contexto de request

O backend usa `pino` e `pino-http` para manter logs estruturados.

Cada request recebe:

- `requestId`, reaproveitado do header quando existir ou gerado no middleware
- `idempotencyKey`, quando enviada pelo cliente

Esses valores ficam disponíveis em `res.locals`, aparecem no logging HTTP e também são usados pelo tratamento centralizado de erros.

A ordem de middleware é:

1. contexto de request
2. logging HTTP
3. rotas
4. tratamento centralizado de erro

## Documentação da API

O backend também expõe documentação OpenAPI 3 via Swagger UI em `GET /docs`.

Esse endpoint documenta:

- `GET /health`
- `POST /payments`
- contratos de request e response
- diferença entre `200` final persistido e `202 PENDING`
- garantias de idempotência e comportamento em concorrência

O objetivo aqui é manter a API autoexplicativa sem introduzir camadas extras além de `swagger-jsdoc` e `swagger-ui-express`.

## Estratégia de testes

Os testes automatizados do backend cobrem o fluxo HTTP completo de `POST /payments` com verificação de estado persistido.

Pontos principais:

- uso de Vitest + Supertest
- banco de teste PostgreSQL real
- uso de `TEST_DATABASE_URL` para apontar para a instância de teste
- isolamento por schema efêmero a cada execução
- aplicação das migrations reais no ambiente de teste
- injeção de processador determinístico e controlado por barreira manual para controlar sucesso, falha e tempo de processamento

Isso permite provar, de forma automatizada, que:

- apenas uma request vence a ownership do processamento
- retries reutilizam exatamente a resposta final persistida
- concorrência não duplica linha nem processamento
- `PENDING` mantém comportamento limitado e consistente

Esse desenho é preferível a bancos embutidos para o Sprint 6 porque a prova principal do desafio depende de semântica real de PostgreSQL sob múltiplas conexões.

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
- usar `Vite` como framework preset
- manter `pnpm install --frozen-lockfile` como install command
- usar `pnpm build` como build command
- publicar o conteúdo de `dist`

Não é obrigatório criar `vercel.json` na raiz para esse fluxo. O caminho mais simples é configurar o diretório do frontend diretamente no painel da Vercel.

### Backend no Render

No Render, a configuração recomendada é:

- conectar o mesmo repositório Git
- criar um Web Service para o backend
- apontar o serviço para a pasta `backend/`
- configurar `DATABASE_URL` com a conexão do Postgres do próprio Render
- configurar `FRONTEND_URL` com a URL pública da Vercel
- usar `pnpm install --frozen-lockfile && pnpm build` como build command
- usar `pnpm start` como start command
- expor `GET /health` como health check path
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

### Migrations no deploy

Como o projeto evita adicionar infraestrutura desnecessária nesta fase, as migrations podem ser aplicadas com um comando manual simples usando a `DATABASE_URL` do ambiente:

```bash
cd backend
DATABASE_URL=postgresql://... pnpm db:migrate
```

Isso é suficiente para o escopo do desafio e evita introduzir automação de deploy antes de ela ser realmente necessária.

## Comunicação entre frontend e backend

Como os serviços ficam em hosts diferentes, o frontend deve consumir a API por URL pública configurada em variável de ambiente.

Exemplo:

```env
VITE_API_URL=https://seu-backend.onrender.com
```

No backend, as variáveis mínimas para produção ficam nesta linha:

```env
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://seu-frontend.vercel.app
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

A aplicação frontend não precisa compartilhar processo nem host com o backend. O que precisa existir é:

- URL pública do backend
- CORS configurado corretamente
- contrato HTTP estável

## Estratégia do frontend

O frontend da Sprint 8 foi mantido simples, mas intencional:

- React com estado local
- Vite para desenvolvimento e build
- Tailwind CSS v4 para composição visual
- componentes locais seguindo o padrão oficial do shadcn/ui para `Button`, `Input`, `Card` e `Badge`

Fluxos que a tela precisa demonstrar:

- criação de pagamento com chave inédita
- retry com a mesma `Idempotency-Key`
- duas requests concorrentes com a mesma chave
- exibição do payload enviado
- exibição do status HTTP retornado
- exibição do corpo persistido da resposta
- histórico das tentativas realizadas

Essa abordagem é suficiente para o desafio porque mostra o comportamento do backend de forma clara sem introduzir gerenciamento de cache, data fetching library ou abstrações desnecessárias.

## Execução local

Para desenvolvimento local, o caminho mais direto agora é um único comando na raiz do monorepo:

```bash
pnpm dev:full
```

Esse fluxo:

- sobe o PostgreSQL local no Docker
- aguarda o banco ficar pronto
- aplica as migrations de desenvolvimento e teste
- inicia backend e frontend em paralelo

Se o banco já estiver pronto, o atalho continua sendo:

```bash
pnpm dev
```

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
