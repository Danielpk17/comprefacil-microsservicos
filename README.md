# CompreFácil: microsserviços de pagamento e notificação

Desafio GR02 da unidade curricular **Desenvolvimento de Sistemas Distribuídos** (UniSENAI).

A CompreFácil quer separar o processamento de pagamentos e o envio de notificações em serviços independentes, que escalam e falham de forma isolada. Este repositório implementa os dois primeiros microsserviços em Node.js, conversando de forma **assíncrona** pelo RabbitMQ:

| Serviço | Porta | Interfaces | Responsabilidade |
| --- | --- | --- | --- |
| `payment-service` | 4000 | REST + AMQP | Recebe a solicitação de pagamento, grava a transação como `PENDING`, processa e confirma (`SUCCESS`), publica os eventos |
| `notification-service` | 4001 | REST + AMQP | Consome os eventos de pagamento, envia o e-mail ao cliente e registra o histórico de notificações |

A infraestrutura sobe com `docker-compose`: **Postgres** (um banco para cada serviço), **RabbitMQ** (com painel de gerenciamento) e **Mailpit** (servidor SMTP de testes com caixa de entrada web, onde os e-mails enviados aparecem de verdade).

## Arquitetura

```mermaid
flowchart LR
    cliente([Cliente]) -->|"REST: POST /payments"| pay["payment-service<br/>:4000"]
    pay <--> dbp[("Postgres<br/>banco payment")]
    pay -->|"AMQP publish<br/>payment.requested<br/>payment.confirmed"| ex{{"exchange payments<br/>(topic)"}}
    ex -->|"payment.requested"| qp[["fila payment.processing"]]
    qp -->|"AMQP consume"| pay
    ex -->|"payment.requested<br/>payment.confirmed"| qn[["fila notification.payment-events"]]
    qn -->|"AMQP consume"| notif["notification-service<br/>:4001"]
    notif <--> dbn[("Postgres<br/>banco notification")]
    notif -->|"SMTP"| mail["Mailpit<br/>:8025"]
    cliente -.->|"REST: GET /notifications"| notif
```

Nenhum serviço chama o outro diretamente nem lê o banco do outro. O único ponto de contato é o contrato das mensagens na exchange `payments`.

## Fluxo da transação

```mermaid
sequenceDiagram
    actor C as Cliente
    participant P as payment-service
    participant R as RabbitMQ
    participant N as notification-service
    participant M as Mailpit

    C->>P: POST /payments
    P->>P: I. grava a transação PENDING (e o evento no outbox)
    P-->>C: 202 Accepted (status PENDING)
    P->>R: II. publica payment.requested
    R->>N: entrega na fila notification.payment-events
    N->>M: III. e-mail "Recebemos o pagamento"
    R->>P: entrega na fila payment.processing
    P->>P: IV. confirma e atualiza para SUCCESS (e o evento no outbox)
    P->>R: V. publica payment.confirmed
    R->>N: entrega na fila notification.payment-events
    N->>M: VI. e-mail "Pagamento confirmado"
```

O cliente recebe a resposta logo após a etapa I. Todo o resto acontece de forma assíncrona, por mensagens.

| Etapa do enunciado | Onde está no código |
| --- | --- |
| I. armazena a transação com status pendente | `requestPayment` em [`payment.service.js`](payment-service/src/payments/payment.service.js) |
| II. publica mensagem do recebimento | evento `payment.requested` gravado no outbox e publicado por [`outbox.js`](payment-service/src/outbox.js) |
| III. notificação lê a fila e avisa o usuário | `handlePaymentEvent` em [`notification.service.js`](notification-service/src/notifications/notification.service.js) |
| IV. confirma a transação e atualiza para sucesso | `handlePaymentRequested` em [`payment.service.js`](payment-service/src/payments/payment.service.js), consumindo a fila `payment.processing` |
| V. publica mensagem da confirmação | evento `payment.confirmed`, também via outbox |
| VI. notificação lê a fila e avisa o usuário | mesmo consumidor, template de `payment.confirmed` em [`notification.templates.js`](notification-service/src/notifications/notification.templates.js) |

## Como executar

**Pré-requisitos:** Docker com Docker Compose e Node.js 22 ou superior.

### Opção 1: infraestrutura no Docker e serviços com Node

1. Suba Postgres, RabbitMQ e Mailpit:

   ```bash
   docker compose up -d
   ```

2. Em um terminal, o serviço de pagamento:

   ```bash
   cd payment-service
   npm install
   npm start
   ```

3. Em outro terminal, o serviço de notificação:

   ```bash
   cd notification-service
   npm install
   npm start
   ```

4. Em um terceiro terminal, rode a demonstração do fluxo completo:

   ```bash
   node scripts/demo.mjs
   ```

   Saída esperada:

   ```text
   [+0.2s] 202 Accepted: transação 2b4f1839-... registrada com status PENDING
   [+0.7s] notification-service: payment.requested -> "Recebemos o pagamento do pedido #451906" para cliente@comprefacil.com.br
   [+3.3s] payment-service: status da transação mudou para SUCCESS
   [+3.3s] notification-service: payment.confirmed -> "Pagamento confirmado: pedido #451906" para cliente@comprefacil.com.br
   [+3.3s] Fluxo completo. Veja os e-mails em http://localhost:8025
   ```

Os bancos e as tabelas são criados automaticamente: o `docker compose` cria os bancos `payment` e `notification`, e cada serviço aplica o próprio `schema.sql` ao iniciar.

### Opção 2: tudo no Docker

```bash
docker compose --profile apps up -d --build
node scripts/demo.mjs
```

O perfil `apps` constrói as imagens dos dois serviços e sobe tudo junto. Os logs ficam em `docker compose --profile apps logs -f payment-service notification-service`.

### Testando manualmente

Com `curl`:

```bash
curl -i -X POST http://localhost:4000/payments \
  -H "Content-Type: application/json" \
  -d '{"userId":"10","customerEmail":"cliente@comprefacil.com.br","orderNumber":"1001","amount":259.90}'

curl http://localhost:4000/payments/<id-da-transacao>
curl "http://localhost:4001/notifications?transactionId=<id-da-transacao>"
```

No PowerShell:

```powershell
$body = @{ userId = "10"; customerEmail = "cliente@comprefacil.com.br"; orderNumber = "1001"; amount = 259.90 } | ConvertTo-Json
$tx = Invoke-RestMethod -Method Post -Uri http://localhost:4000/payments -ContentType "application/json" -Body $body
Invoke-RestMethod "http://localhost:4000/payments/$($tx.id)"
Invoke-RestMethod "http://localhost:4001/notifications?transactionId=$($tx.id)"
```

O arquivo [`requests.http`](requests.http) tem as mesmas chamadas para a extensão REST Client do VS Code.

## Endereços

| O quê | Endereço | Acesso |
| --- | --- | --- |
| payment-service | http://localhost:4000 | |
| notification-service | http://localhost:4001 | |
| Painel do RabbitMQ | http://localhost:15672 | `comprefacil` / `comprefacil` |
| Caixa de entrada do Mailpit | http://localhost:8025 | |
| Postgres | `localhost:5434` | `postgres` / `postgres`, bancos `payment` e `notification` |

O Postgres é publicado na porta **5434** para não colidir com um Postgres local que já esteja usando a 5432.

## API REST

### payment-service

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/payments` | Solicita um pagamento. Responde **202 Accepted** com a transação em `PENDING` |
| `GET` | `/payments/:id` | Consulta uma transação (`PENDING` ou `SUCCESS`) |
| `GET` | `/payments?userId=10` | Lista as transações, opcionalmente filtradas por usuário |
| `GET` | `/health` | Estado do serviço, do banco e da conexão com o RabbitMQ |

Corpo do `POST /payments`:

```json
{
  "userId": "10",
  "customerEmail": "cliente@comprefacil.com.br",
  "orderNumber": "1001",
  "amount": 259.90
}
```

Resposta (`202 Accepted`, com o header `Location: /payments/<id>`):

```json
{
  "id": "2b4f1839-d7a6-478c-b3c0-be35bd4d2140",
  "userId": "10",
  "customerEmail": "cliente@comprefacil.com.br",
  "orderNumber": "1001",
  "amount": 259.9,
  "status": "PENDING",
  "createdAt": "2026-10-30T00:34:12.696Z",
  "updatedAt": "2026-10-30T00:34:12.696Z",
  "confirmedAt": null
}
```

Requisições inválidas voltam `400` com a lista de erros (campos obrigatórios, e-mail inválido, valor menor ou igual a zero, mais de duas casas decimais, JSON malformado).

### notification-service

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/notifications?transactionId=<uuid>` | Notificações enviadas para uma transação |
| `GET` | `/notifications?userId=10` | Notificações enviadas para um usuário |
| `GET` | `/health` | Estado do serviço, do banco e da conexão com o RabbitMQ |

## Mensageria (AMQP)

| Elemento | Nome | Detalhe |
| --- | --- | --- |
| Exchange | `payments` | tipo `topic`, durável |
| Routing keys | `payment.requested`, `payment.confirmed` | um evento para cada mudança de estado da transação |
| Fila | `payment.processing` | recebe `payment.requested`; consumida pelo próprio payment-service para confirmar o pagamento |
| Fila | `notification.payment-events` | recebe `payment.requested` e `payment.confirmed`; consumida pelo notification-service |
| Filas de erro | `payment.processing.dlq`, `notification.payment-events.dlq` | mensagens que falharam duas vezes |

Formato de uma mensagem (evento `payment.requested`):

```json
{
  "eventId": "cb4c6261-8ab3-4dcb-8dd3-cc4e468489da",
  "type": "payment.requested",
  "occurredAt": "2026-10-30T00:34:12.713Z",
  "data": {
    "transactionId": "2b4f1839-d7a6-478c-b3c0-be35bd4d2140",
    "userId": "10",
    "customerEmail": "cliente@comprefacil.com.br",
    "orderNumber": "451906",
    "amount": 259.9,
    "status": "PENDING",
    "createdAt": "2026-10-30T00:34:12.696Z",
    "confirmedAt": null
  }
}
```

As mensagens são persistentes, publicadas com *publisher confirms* (o serviço só considera publicado depois que o broker confirma) e consumidas com *ack* manual.

A topologia (exchange, filas e bindings) é declarada em [`docker/rabbitmq/definitions.json`](docker/rabbitmq/definitions.json) e carregada quando o RabbitMQ sobe. Assim as filas existem antes de qualquer serviço iniciar: se o payment-service publicar enquanto o notification-service nunca rodou, a mensagem fica esperando na fila em vez de ser descartada. Cada serviço também declara a parte que usa ao conectar, o que é idempotente.

## Demonstrando a independência dos serviços

**Serviço de notificação fora do ar.** Pare o notification-service (Ctrl+C) e faça um pagamento. O payment-service aceita, confirma e publica normalmente: a transação chega a `SUCCESS` e as duas mensagens ficam aguardando na fila `notification.payment-events` (visível no painel do RabbitMQ). Ao iniciar o notification-service de novo, ele consome o que ficou pendente e envia os dois e-mails.

**RabbitMQ fora do ar.** Rode `docker compose stop rabbitmq` e faça um pagamento. O payment-service continua respondendo `202` e grava a transação em `PENDING`; o evento fica guardado na tabela `outbox`. Com `docker compose start rabbitmq`, os dois serviços reconectam sozinhos, o evento é publicado e o fluxo termina normalmente.

Os dois cenários foram testados durante o desenvolvimento.

## Decisões técnicas

- **Banco por serviço.** Cada serviço tem o próprio banco (`payment` e `notification`) e só acessa o seu. Eles dividem o mesmo contêiner Postgres por simplicidade, mas poderiam ir para servidores diferentes sem mudar código.
- **Transactional outbox.** A transação e o evento são gravados na mesma transação do banco, e um *relay* publica os eventos pendentes no RabbitMQ. Isso evita o problema da escrita dupla (gravar no banco e cair antes de publicar, ou o contrário) e permite aceitar pagamentos mesmo com o broker indisponível.
- **Entrega pelo menos uma vez com consumidor idempotente.** Uma mensagem pode chegar repetida (por exemplo, se o serviço cair entre publicar e marcar como publicado). Por isso a tabela `notifications` tem `event_id` único e um evento repetido não gera um segundo e-mail; e a confirmação só altera transações que ainda estão `PENDING`.
- **Retentativa e DLQ.** Se o processamento falhar, a mensagem volta para a fila uma vez. Se falhar de novo, vai para a fila `.dlq` correspondente para análise, em vez de ficar em loop.
- **Reconexão automática.** Os dois serviços usam a recuperação de conexão do `amqplib` e recriam canais e consumidores quando o RabbitMQ volta.
- **Confirmação simulada.** Não há gateway de pagamento real: a etapa IV espera `PROCESSING_DELAY_MS` (3 segundos por padrão) simulando a autorização e então confirma. Num cenário real, esse é o ponto onde o serviço chamaria a operadora.
- **Sem framework nem ORM.** Os projetos de referência usam NestJS e Prisma. Aqui usei Express, `amqplib` e `pg` diretamente para deixar visíveis os conceitos cobrados (exchange, fila, binding, ack, SQL) e manter cada serviço pequeno.

## Variáveis de ambiente

Todas têm valores padrão compatíveis com o `docker-compose.yml`, então nenhuma configuração é necessária para rodar localmente.

| Serviço | Variável | Padrão |
| --- | --- | --- |
| ambos | `PORT` | `4000` (payment), `4001` (notification) |
| ambos | `DATABASE_URL` | `postgres://postgres:postgres@localhost:5434/payment` ou `.../notification` |
| ambos | `RABBITMQ_URL` | `amqp://comprefacil:comprefacil@localhost:5672` |
| payment | `PROCESSING_DELAY_MS` | `3000` |
| payment | `OUTBOX_INTERVAL_MS` | `1000` |
| notification | `SMTP_HOST` / `SMTP_PORT` | `127.0.0.1` / `1025` |
| notification | `MAIL_FROM` | `CompreFácil <nao-responda@comprefacil.com.br>` |

## Estrutura do repositório

```text
.
├── docker-compose.yml
├── docker/
│   ├── postgres/init.sql            cria o banco notification
│   └── rabbitmq/                    usuário, exchange, filas e bindings
├── payment-service/
│   ├── Dockerfile
│   └── src/
│       ├── server.js                API REST, conexão AMQP e relay do outbox
│       ├── broker.js                topologia, publicação com confirm e consumidor
│       ├── outbox.js
│       ├── database.js / schema.sql
│       └── payments/                rotas, validação, regras e repositório
├── notification-service/
│   ├── Dockerfile
│   └── src/
│       ├── server.js
│       ├── broker.js
│       ├── database.js / schema.sql
│       └── notifications/           consumidor, templates, envio de e-mail e rotas
├── scripts/demo.mjs                 executa e cronometra o fluxo completo
└── requests.http
```

## Encerrando

Para parar tudo:

```bash
docker compose --profile apps down
```

Para parar e apagar também os dados (bancos, filas e e-mails):

```bash
docker compose --profile apps down -v
```

## Autor

Daniel, para a unidade curricular Desenvolvimento de Sistemas Distribuídos, UniSENAI.
