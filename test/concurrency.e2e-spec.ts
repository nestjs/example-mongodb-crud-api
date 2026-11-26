import type { NestNodeApplication } from '@nestjs/platform-node';
import { createTestApp } from './test-app.js';

const url = process.env.TEST_MONGODB_URI;

describe.skipIf(!url)('Concurrent writes (e2e)', () => {
  let app: NestNodeApplication;

  beforeAll(async () => {
    app = await createTestApp('concurrency');
  });
  afterAll(() => app.close());

  it('applies one of ten concurrent updates of the same version, and refuses the rest', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/products',
      payload: { sku: 'RACE-1', name: 'Desk mat', category: 'desk', price: 2500, stock: 10 },
    });
    const { id } = created.json<{ id: string }>();

    // Ten clients read version 1, and each sets a stock of its own.
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        app.inject({ method: 'PATCH', url: `/products/${id}`, payload: { stock: i, version: 1 } }),
      ),
    );

    const statuses = results.map((res) => res.statusCode);
    expect(statuses.sort()).toEqual([200, ...Array(9).fill(409)]);
    const winner = results.find((res) => res.statusCode === 200)!.json<{ stock: number }>();
    const product = (await app.inject({ method: 'GET', url: `/products/${id}` })).json();
    expect(product).toMatchObject({ version: 2, stock: winner.stock });
  });

  it('creates one of ten concurrent products with the same SKU', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/products',
          payload: { sku: 'race-2', name: `Lamp ${i}`, category: 'desk', price: 4900, stock: 1 },
        }),
      ),
    );
    expect(results.map((res) => res.statusCode).sort()).toEqual([201, ...Array(9).fill(409)]);
  });
});
