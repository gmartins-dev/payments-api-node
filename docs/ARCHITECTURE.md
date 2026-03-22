# Arquitetura do Projeto

## Visão geral

Este projeto é um monorepo com dois aplicativos:

- `backend/`: API de pagamentos idempotentes em Node.js, TypeScript e Express
- `frontend/`: interface de demonstração em React, Vite, Tailwind CSS e componentes no padrão shadcn/ui

Hospedagem recomendada:

- frontend na Vercel
- backend no Render
- PostgreSQL no Render

Neon também pode ser usado como alternativa de Postgres em nuvem.

## Decisões principais

As decisões centrais da solução são:

- PostgreSQL como fonte de verdade da idempotência
- `UNIQUE(idempotency_key)` como mecanismo principal de deduplicação
- persistência do `response_status_code` e do `response_body`
- polling curto para observar transição de `PENDING`
- ausência de estado em memória para correção do fluxo

Isso mantém a correção do sistema concentrada em uma única base transacional.

## Por que PostgreSQL é a fonte de verdade

A garantia relevante deste desafio não é apenas “não duplicar insert”, mas também:

- garantir que só uma request processe de fato
- permitir replay do mesmo resultado em retries
- responder de forma consistente sob concorrência

Por isso, o fluxo depende do banco para:

- registrar o primeiro `PENDING`
- definir ownership do processamento
- persistir o resultado final
- permitir replay exato do estado salvo

Redis pode existir como otimização, mas não como base de correção.

## Como a concorrência é tratada

O fluxo de `POST /payments` é:

1. validar body e `Idempotency-Key`
2. tentar `INSERT ... ON CONFLICT DO NOTHING RETURNING *`
3. se inseriu, essa request venceu a corrida e processa
4. se não inseriu, buscar o registro existente
5. se o registro já estiver em `SUCCESS` ou `FAILED`, retornar exatamente a resposta persistida
6. se estiver em `PENDING`, fazer polling curto e retornar o estado final ou `202`

Esse desenho garante que apenas uma request execute o processamento para a mesma chave.

## Atomicidade do PostgreSQL e por que não usar lock distribuído

A solução depende de:

- atomicidade de escrita no PostgreSQL
- constraint única em `idempotency_key`
- transação para a escrita do estado final

Isso é suficiente para o problema proposto e evita a complexidade de lock distribuído explícito.

Não há necessidade de Redis lock ou mecanismo semelhante porque:

- a corrida principal já é resolvida pelo `UNIQUE(idempotency_key)`
- o resultado final fica persistido na mesma base
- retries e concorrência consultam o mesmo estado transacional

## Read-after-write e correção do polling

O polling sobre `PENDING` é seguro neste desenho porque a própria aplicação lê do mesmo PostgreSQL onde o estado final foi gravado.

Na prática:

- a request vencedora persiste `SUCCESS` ou `FAILED`
- as demais consultam o banco durante a janela de polling
- assim que o estado final aparece, a mesma resposta persistida é reaproveitada

Essa consistência read-after-write é suficiente para o caso de uso.

## Como o desenho evita eventual consistency

O fluxo crítico evita eventual consistency porque todas as transições relevantes ficam no mesmo banco:

- criação do `PENDING`
- promoção para `SUCCESS` ou `FAILED`
- persistência do corpo de resposta final
- replay do mesmo resultado

Não há sincronização assíncrona entre múltiplas fontes de verdade para a correção do pagamento.

## Contrato HTTP: `200` versus `202`

A API usa:

- `200` para resultado final persistido
- `202` para `PENDING` após timeout de polling

Detalhe importante:

- `200 SUCCESS` e `200 FAILED` existem porque o contrato principal é devolver exatamente o resultado final já persistido para aquela chave
- `202` representa apenas um estado transitório ainda não finalizado

## Estratégia de polling para `PENDING`

O polling é propositalmente curto:

- intervalo de `100ms`
- timeout máximo de `3s`

Objetivo:

- dar chance de devolver o resultado final sem obrigar o cliente a retry imediato
- evitar bloqueio longo da request
- manter o comportamento previsível e simples

Se o estado final não aparecer dentro da janela, a resposta é `202 PENDING`.

## Estratégia de `updated_at`

A coluna `updated_at` é mantida por trigger no banco.

Isso foi escolhido para:

- reduzir risco de inconsistência entre caminhos de escrita
- manter o comportamento protegido no nível da persistência
- evitar depender apenas de disciplina no código de aplicação

## Notas de produção

Melhorias naturais fora do escopo do MVP:

- retenção de `Idempotency-Key` por janela, por exemplo `24h`
- rejeição explícita para payload divergente com a mesma chave
- trilha de auditoria mais forte para reuso incorreto da chave

Essas evoluções refinam o contrato, mas não mudam a correção central do desenho atual.

## Neon e pooling

Neon pode ser usado como Postgres em nuvem para este projeto, mas exige atenção ao pooling.

Pontos importantes:

- Neon já usa PgBouncer no lado deles
- adicionar mais uma camada agressiva de pooling na aplicação pode criar “double pooling”
- para este serviço, a configuração simples com `pg` é suficiente

Em outras palavras, o backend não precisa de uma estratégia adicional sofisticada de pool para funcionar bem neste desafio. O mais importante é manter a conexão simples e evitar sobreposição desnecessária com o pooling do Neon.

## Resumo arquitetural

O projeto prioriza:

- correção de idempotência antes de complexidade de infraestrutura
- concorrência segura com base em primitives do PostgreSQL
- replay exato da resposta persistida
- documentação e testes que tornam o comportamento auditável

Esse é o melhor equilíbrio para um desafio técnico curto: forte onde importa, sem overengineering.
