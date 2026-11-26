import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  // Not z.url(): a replica set's URI lists several hosts, which isn't a valid URL.
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\/.+/, 'Expected a mongodb:// or mongodb+srv:// URI'),
  // The browser origins allowed to call the API, comma-separated. None by default.
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.url())),
});

export type Env = z.infer<typeof envSchema>;
