import type { NestNodeApplication } from '@nestjs/platform-node';
import { createTestApp } from './test-app.js';

const url = process.env.TEST_MONGODB_URI;

describe.skipIf(!url)('Products API (e2e)', () => {
  let app: NestNodeApplication;

  beforeAll(async () => {
    app = await createTestApp('products');
  });
  afterAll(() => app.close());

  const keyboard = {
    sku: 'kb-001',
    name: 'Mechanical keyboard',
    description: 'Hot-swappable switches',
    category: 'Keyboards',
    price: 12900,
    stock: 5,
  };

  async function create(payload: object) {
    const res = await app.inject({ method: 'POST', url: '/products', payload });
    expect(res.statusCode).toBe(201);
    return res.json<{ id: string; version: number }>();
  }

  it('creates, reads, updates and deletes a product, with `id` and no `_id` or `__v`', async () => {
    const created = await create(keyboard);
    expect(created).toMatchObject({ sku: 'KB-001', category: 'keyboards', version: 1 });
    expect(created).not.toHaveProperty('_id');
    expect(created).not.toHaveProperty('__v');

    const found = await app.inject({ method: 'GET', url: `/products/${created.id}` });
    expect(found.json()).toEqual(created);

    const updated = await app.inject({
      method: 'PATCH',
      url: `/products/${created.id}`,
      payload: { price: 13900, version: 1 },
    });
    expect(updated.statusCode).toBe(200);
    // Only the price changed: the fields the client didn't send are untouched.
    expect(updated.json()).toMatchObject({ ...created, price: 13900, version: 2, updatedAt: expect.any(String) });

    expect((await app.inject({ method: 'DELETE', url: `/products/${created.id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/products/${created.id}` })).statusCode).toBe(404);
  });

  it('answers 400 for a malformed id and 404 for an unknown one', async () => {
    for (const method of ['GET', 'PATCH', 'DELETE'] as const) {
      const res = await app.inject({ method, url: '/products/not-an-id', payload: { stock: 1, version: 1 } });
      expect(res.statusCode).toBe(400);
    }
    const unknown = await app.inject({ method: 'GET', url: '/products/507f1f77bcf86cd799439011' });
    expect(unknown.statusCode).toBe(404);
    const unknownUpdate = await app.inject({
      method: 'PATCH',
      url: '/products/507f1f77bcf86cd799439011',
      payload: { stock: 1, version: 1 },
    });
    expect(unknownUpdate.statusCode).toBe(404);
  });

  it('answers 409 for a duplicate SKU, in any letter case, on create and on update', async () => {
    await create({ ...keyboard, sku: 'MS-001', name: 'Mouse' });
    const duplicate = await app.inject({ method: 'POST', url: '/products', payload: { ...keyboard, sku: 'ms-001' } });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ errorCode: 'DUPLICATE_KEY' });

    const other = await create({ ...keyboard, sku: 'MS-002', name: 'Mouse 2' });
    const renamed = await app.inject({
      method: 'PATCH',
      url: `/products/${other.id}`,
      payload: { sku: 'MS-001', version: other.version },
    });
    expect(renamed.statusCode).toBe(409);
  });

  it('refuses query operators wherever a value is expected', async () => {
    const { id } = await create({ ...keyboard, sku: 'OP-001' });
    const attempts = [
      { method: 'POST', url: '/products', payload: { ...keyboard, sku: 'OP-002', name: { $gt: '' } } },
      // A version of { $gte: 0 } would match any version, and skip the stale-write check.
      { method: 'PATCH', url: `/products/${id}`, payload: { stock: 0, version: { $gte: 0 } } },
      { method: 'GET', url: '/products?category[$ne]=keyboards' },
      { method: 'GET', url: '/products?category=a&category=b' },
      { method: 'GET', url: `/products?cursor=${encode([{ $gt: 0 }, id])}` },
      { method: 'GET', url: `/products?cursor=${encode([1e300, id])}` },
      { method: 'GET', url: '/products?sort=stock' },
    ] as const;
    for (const attempt of attempts) {
      expect((await app.inject(attempt)).statusCode).toBe(400);
    }
    const product = await app.inject({ method: 'GET', url: `/products/${id}` });
    expect(product.json()).toMatchObject({ name: 'Mechanical keyboard', stock: 5, version: 1 });
  });

  it('refuses an update with nothing to update, or with a null field', async () => {
    const { id } = await create({ ...keyboard, sku: 'NU-001' });
    for (const payload of [{ version: 1 }, { name: null, version: 1 }, { price: 19.99, version: 1 }]) {
      expect((await app.inject({ method: 'PATCH', url: `/products/${id}`, payload })).statusCode).toBe(400);
    }
  });

  it('pages through a filtered list in every sort, without repeating or skipping a product', async () => {
    // Twelve mice at four prices: ties that only the _id tiebreaker orders.
    const ids = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const { id } = await create({ sku: `PG-${i}`, name: `Mouse ${i}`, category: 'mice', price: 1000 + (i % 4) * 500, stock: i % 3 });
      ids.add(id);
    }

    type Item = { id: string; price: number; createdAt: string };
    for (const [sort, key, sign] of [['-createdAt', 'createdAt', -1], ['price', 'price', 1], ['-price', 'price', -1]] as const) {
      const seen: Item[] = [];
      let cursor: string | null = null;
      do {
        const res = await app.inject({
          method: 'GET',
          url: `/products?category=mice&sort=${sort}&limit=5${cursor ? `&cursor=${cursor}` : ''}`,
        });
        expect(res.statusCode).toBe(200);
        const page: { items: Item[]; nextCursor: string | null } = res.json();
        seen.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);

      expect(seen.map((p) => p.id).sort()).toEqual([...ids].sort());
      expect(seen.every((p) => !('_id' in p))).toBe(true);
      const values = seen.map((p) => (key === 'price' ? p.price : Date.parse(p.createdAt)));
      expect(values).toEqual([...values].sort((a, b) => sign * (a - b)));
    }

    const inStock = await app.inject({ method: 'GET', url: '/products?category=mice&inStock=true&maxPrice=1500' });
    const items = inStock.json<{ items: { price: number; stock: number }[] }>().items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.stock > 0 && p.price <= 1500)).toBe(true);
  });
});

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
