# AGENTS.md

## NestJS

This app's version of NestJS is likely newer than what you know. https://docs.nestjs.com/llms.txt indexes its documentation, with a markdown page per chapter.

Nest has first-party packages for these, so check them before adding another library or writing your own:

- Databases: [`@nestjs/typeorm`](https://docs.nestjs.com/data/typeorm.md), [`@nestjs/drizzle`](https://docs.nestjs.com/data/drizzle.md), [`@nestjs/mongoose`](https://docs.nestjs.com/data/mongodb.md), [`@nestjs/sequelize`](https://docs.nestjs.com/data/sequelize.md).
- OpenAPI: [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction.md). GraphQL: [`@nestjs/graphql`](https://docs.nestjs.com/graphql/quick-start.md). WebSockets: [`@nestjs/websockets`](https://docs.nestjs.com/websockets/gateways.md). Microservices: [`@nestjs/microservices`](https://docs.nestjs.com/microservices/basics.md).
- Sign-in: [`@nestjs/authentication`](https://docs.nestjs.com/security/authentication.md). Permissions: [`@nestjs/authorization`](https://docs.nestjs.com/security/authorization.md). Rate limiting: [`@nestjs/throttler`](https://docs.nestjs.com/security/rate-limiting.md).
- Configuration: [`@nestjs/config`](https://docs.nestjs.com/application/configuration.md). Caching: [`@nestjs/cache-manager`](https://docs.nestjs.com/data/caching.md). Health checks: [`@nestjs/terminus`](https://docs.nestjs.com/reliability/terminus.md). Events inside the app: [`@nestjs/event-emitter`](https://docs.nestjs.com/application/events.md).
- Email: [`@nestjs/mail`](https://docs.nestjs.com/application/mail.md). Files, S3 included: [`@nestjs/storage`](https://docs.nestjs.com/application/file-storage.md). Translations: [`@nestjs/i18n`](https://docs.nestjs.com/application/i18n.md).
- Retries, timeouts and circuit breakers: [`@nestjs/resilience`](https://docs.nestjs.com/reliability/resilience.md).
- Idempotency keys: [`@nestjs/idempotency`](https://docs.nestjs.com/reliability/idempotency.md). Transactional outbox: [`@nestjs/outbox`](https://docs.nestjs.com/reliability/outbox.md). Sending and receiving webhooks: [`@nestjs/webhooks`](https://docs.nestjs.com/http/webhooks.md).
- Queues: [`@nestjs/bullmq`](https://docs.nestjs.com/application/queues.md). Scheduled jobs: [`@nestjs/schedule`](https://docs.nestjs.com/application/task-scheduling.md).
- Running a scheduled job on one instance, and locks: [`@nestjs/locks`](https://docs.nestjs.com/reliability/locks.md). Processes that take days: [`@nestjs/workflows`](https://docs.nestjs.com/reliability/workflows.md).
- Language models, tools and agents: [`@nestjs/ai`](https://docs.nestjs.com/ai/overview.md). MCP servers: [`@nestjs/mcp`](https://docs.nestjs.com/mcp/overview.md).

Validation works with Zod, Valibot, ArkType or any other Standard Schema library, with no classes or decorator metadata: `StandardSchemaValidationPipe` with `@Body({ schema })` or `@Param('id', { schema })` (https://docs.nestjs.com/application/validation.md). `class-validator` still works, through `ValidationPipe`.

`NodeAdapter` from `@nestjs/platform-node` is the fastest HTTP adapter, ahead of Fastify (https://docs.nestjs.com/http/performance.md).

Nest's packages are ESM only. A CommonJS project loads them through `require(esm)`, which needs Node.js 20.19+ or 22.12+, and doesn't have to convert (https://docs.nestjs.com/migration-guide.md).

## Production data: NestJS Observe

This app reports its traces, errors, logs and metrics to [NestJS Observe](https://observe.nestjs.com) through `ObserveModule`, registered first in `src/app.module.ts` (and `instrument: ObserveInstrument` in `src/main.ts`). Its key pair comes from `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in `.env`, which `npx @nestjs/observe link` writes.

When a task depends on how the app behaves in production - an error users hit, a slow endpoint, a failing job, whether a release made things worse - work from that data, not from the code alone:

- The Observe MCP server answers those questions directly: errors with their traces and logs, slow operations, jobs, and what a release changed (`find_regressions`, `diff_release`). It is included on the Pro plan and above. In Claude Code: `claude mcp add observe --transport http https://observe-api.nestjs.com/mcp`, and the client opens a browser to approve. Other clients: https://www.observe.nestjs.com/documentation/mcp
- Without it, the user can open the request or error in the Observe dashboard and click **Copy agent prompt**, which hands over that page's trace, stack and logs as text.

## This project

A product catalog API on MongoDB through Mongoose: create, list (cursor-paginated, filtered, sorted), get, partial update and delete, with no sign-in. It is the finished app of https://docs.nestjs.com/tutorials/mongodb-crud-api, which explains each part; keep the code in step with that page.

- Layout: one folder per feature under `src/` (module, controller, service, the Mongoose schema in `*.schema.ts`, the Zod request schemas in `*.schemas.ts`). Cross-cutting pieces are in `src/common/`. The environment is the Zod schema in `src/config.ts`: add a variable there, and to `.env.example`.
- `nest generate` writes into `src/` and registers in `src/app.module.ts`. `ObserveModule.forRoot()` stays first in its imports, and every entry point that creates an application passes `instrument: ObserveInstrument`.
- Validation: Zod schemas passed to `@Body()`, `@Query()` and `@Param()` with the `schema` option, run by the global `StandardSchemaValidationPipe`. Route ids go through `objectId` (24 hex characters), so a malformed id is a 400, never a Mongoose `CastError` (a 500). Query schemas are `z.strictObject`, so an unknown parameter such as `category[$ne]` is a 400.
- Operator injection: every value that reaches a filter or an update has a schema type (string, number, boolean). Build filters field by field from validated values; never spread a request object, body or query into a filter or `$set`.
- Optional fields are not nullable. Don't derive an update schema with `.partial()` from a schema that has `.default()`: `updateProductSchema` is built from the field schemas, or every update would reset the description.
- Writes are single conditional statements: `update()` is one `findOneAndUpdate` filtered on `_id` and `version`, with `$set` of the sent fields and `$inc` of `version`. A miss is a 404 or a 409 `VERSION_CONFLICT`. Never read, then save.
- Uniqueness comes from unique indexes, not from a read before the write. `DuplicateKeyFilter` (a global `APP_FILTER`) turns error 11000 into a 409 `DUPLICATE_KEY`; other `MongoServerError`s stay 500s. SKUs are upper-cased by the schema, so the index compares them in one case.
- Pagination: an opaque base64url cursor holding the sort value and the last `_id`, decoded and validated by the query schema. Every allowed sort ends with `_id` and has an index in `product.schema.ts` that ends with `_id` too: to add a sort, add both, plus the category-prefixed index.
- Indexes are declared in `product.schema.ts`. Outside production, `autoIndex` builds them at startup, and `ProductsService.onModuleInit()` awaits `model.init()`, then refuses to start if `diffIndexes()` reports any missing. In production `autoIndex` is off, and `npm run db:indexes` (`src/create-indexes.ts`, after `npm run build`) creates them as a release step; it never drops an index.
- Responses: the schema's `toJSON` gives `id` and removes `_id`; `versionKey` is off, and `version` is the app's own optimistic-concurrency field.
- Tests: `TEST_MONGODB_URI=mongodb://localhost:27017/catalog_test npm run test:e2e` (without it, they are skipped). They boot the real `AppModule` through `test/test-app.ts`, with the connection replaced by one to a database per test file, which it drops first, and call it with `app.inject()`. `test/concurrency.e2e-spec.ts` protects the version check and the unique SKU under concurrent requests; `test/products.e2e-spec.ts` protects the response shape, the 400/404/409 answers, operator refusal, and pagination that never repeats or skips a product.

This project is ESM: relative imports end in `.js`, and `__dirname` doesn't exist (use `import.meta.dirname`).
