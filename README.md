# CRUD REST API with Node.js and MongoDB

This is the finished application of the tutorial [Build a CRUD REST API with Node.js and MongoDB](https://docs.nestjs.com/tutorials/mongodb-crud-api) in the NestJS documentation. The tutorial builds it step by step and explains every decision; this repository is the result, ready to clone.

## What it does

A product catalog API on MongoDB through Mongoose: create a product, list the catalog page by page, read one, change some of its fields, delete it.

- Responses carry `id` instead of `_id`, and no `__v`.
- Every body, query string and route parameter is validated with a Zod schema, which also refuses query operators such as `$gt` where a value is expected.
- A malformed ObjectId is a 400, an unknown one a 404, and a duplicate SKU (in any letter case) a 409.
- An update writes only the fields it sends, and is refused with a 409 when it was made from a stale version.
- The list pages with an opaque cursor, filters by category, price and stock, and sorts only by what has an index.
- The app refuses to start when its configuration is invalid or an index is missing.
- Security headers, CORS for the origins you list, an OpenAPI document, liveness and readiness checks, and JSON logs in production.

There is no sign-in: the tutorial keeps the MongoDB parts in focus.

## Run it

You need Node.js 22.9 or later, and Docker for MongoDB.

```bash
git clone https://github.com/nestjs/example-mongodb-crud-api.git
cd example-mongodb-crud-api
npm install
cp .env.example .env
docker compose up -d
npm run start
```

The API listens on http://localhost:3000, with Swagger UI at http://localhost:3000/docs. Outside production, Mongoose builds the indexes the schema declares at startup, so there is no migration step.

```bash
curl localhost:3000/products --json '{"sku":"kb-001","name":"Mechanical keyboard","category":"Keyboards","price":12900,"stock":5}'
curl 'localhost:3000/products?category=keyboards&sort=price&limit=2'
```

## Endpoints

| Endpoint | Tutorial section |
| --- | --- |
| `POST /products`, `GET /products/:id`, `PATCH /products/:id`, `DELETE /products/:id` | [Build the CRUD endpoints](https://docs.nestjs.com/tutorials/mongodb-crud-api#build-the-crud-endpoints) |
| `GET /products` (`category`, `minPrice`, `maxPrice`, `inStock`, `sort`, `limit`, `cursor`) | [Paginate, filter and sort the list](https://docs.nestjs.com/tutorials/mongodb-crud-api#paginate-filter-and-sort-the-list) |
| `GET /health/live`, `GET /health/ready` | [Add health checks](https://docs.nestjs.com/tutorials/mongodb-crud-api#add-health-checks) |
| `GET /docs` (Swagger UI), `GET /docs-json` | [Assemble the application](https://docs.nestjs.com/tutorials/mongodb-crud-api#assemble-the-application) |

Prices are integer cents. `PATCH` takes the `version` the client read, along with the fields to change.

## Layout

| Path | What it holds |
| --- | --- |
| `src/main.ts` | bootstrap on the Node adapter, JSON logs in production, security headers, CORS, Swagger UI |
| `src/app.module.ts` | NestJS Observe, config, the Mongoose connection, the global validation pipe and duplicate-key filter |
| `src/config.ts` | the environment, as a Zod schema checked at startup |
| `src/products/product.schema.ts` | the Mongoose schema and its indexes |
| `src/products/products.schemas.ts` | the Zod schemas of the requests: ids, create, update, list query and cursor |
| `src/products/products.service.ts` | the queries: conditional updates, cursor pagination, the index check at startup |
| `src/products/products.controller.ts` | the routes |
| `src/common/duplicate-key.filter.ts` | MongoDB's duplicate key error as a 409 |
| `src/health/` | liveness and readiness |
| `src/create-indexes.ts` | the `npm run db:indexes` release step |
| `test/` | e2e tests against a real MongoDB server |

## Tests

```bash
TEST_MONGODB_URI=mongodb://localhost:27017/catalog_test npm run test:e2e
```

Each test file empties and uses a database of its own, named after the URI's (`catalog_test_products`, `catalog_test_concurrency`), so never point `TEST_MONGODB_URI` at a database you want to keep. Without `TEST_MONGODB_URI`, the tests are skipped.

## Stack

[NestJS](https://nestjs.com) 12 on the Node adapter, [Zod](https://zod.dev) validation, [Mongoose](https://mongoosejs.com) through [`@nestjs/mongoose`](https://docs.nestjs.com/data/mongodb) and MongoDB 8, [`@nestjs/config`](https://docs.nestjs.com/application/configuration), [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction), [`@nestjs/terminus`](https://docs.nestjs.com/reliability/terminus), [NestJS Observe](https://docs.nestjs.com/observability/overview), and Vitest.

## Production

Read the tutorial's production checklist first: https://docs.nestjs.com/tutorials/mongodb-crud-api#production-checklist. With `NODE_ENV=production`, the app doesn't build indexes, and refuses to start until `npm run build && npm run db:indexes` has created them.

To see requests, errors and slow queries per route in production, link the app to [NestJS Observe](https://docs.nestjs.com/observability/overview): `npx @nestjs/observe link` writes the key pair (`OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET`) into `.env`. `ObserveModule` is already registered in `src/app.module.ts`; until the keys are set, it sends nothing.

## License

MIT
