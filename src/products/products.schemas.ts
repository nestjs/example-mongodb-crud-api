import { z } from 'zod';

// 24 hex characters: anything else would make Mongoose throw a CastError, a 500.
export const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Invalid ObjectId');

// Upper-cased, so `kb-001` and `KB-001` are the same SKU to the unique index.
const sku = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{3,32}$/, 'Expected 3 to 32 letters, digits or dashes')
  .toUpperCase();
const name = z.string().trim().min(1).max(200);
const description = z.string().max(5_000);
const category = z.string().trim().toLowerCase().min(1).max(50);
// In cents: 1999 is 19.99.
const price = z.number().int().positive().max(10_000_000);
const stock = z.number().int().min(0);

export const createProductSchema = z.object({
  sku,
  name,
  description: description.default(''),
  category,
  price,
  stock,
});
export type CreateProductDto = z.infer<typeof createProductSchema>;

// Every field optional, none nullable, plus the version the client read.
// Built from the field schemas: createProductSchema.partial() would keep
// the description's default, and clear it on every update.
export const updateProductSchema = z
  .object({ sku, name, description, category, price, stock })
  .partial()
  .extend({ version: z.number().int().positive() })
  .refine((dto) => Object.keys(dto).length > 1, 'Nothing to update');
export type UpdateProductDto = z.infer<typeof updateProductSchema>;

// The cursor is opaque to the client, but it's client input all the same: it's
// decoded and validated like the rest of the query, before it reaches a filter.
const cursor = z
  .base64url()
  .max(200)
  .transform((value, ctx) => {
    try {
      return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid cursor' });
      return z.NEVER;
    }
  })
  // The sort value (a price, or a creation time in milliseconds) and the _id of the page's last product.
  // Bounded: 1e300 is a number, but not a date MongoDB can compare with.
  .pipe(z.tuple([z.number().int().min(0).max(8.64e15), objectId]));

// Strict: an unknown or misspelled parameter is a 400, not an unfiltered list.
export const listProductsQuerySchema = z.strictObject({
  category: category.optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: z.stringbool().optional(),
  // Only the sorts that have an index: see the schema.
  sort: z.enum(['-createdAt', 'price', '-price']).default('-createdAt'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: cursor.optional(),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
