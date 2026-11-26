import { createConnection } from 'mongoose';
import { envSchema } from './config.js';
import { Product, ProductSchema } from './products/product.schema.js';

// A release step: builds the indexes the schemas declare, before the new version starts.
const { MONGODB_URI } = envSchema.parse(process.env);
const connection = await createConnection(MONGODB_URI, { autoIndex: false }).asPromise();
try {
  // Creates the missing indexes and changes nothing else: unlike syncIndexes(), it never drops one.
  await connection.model(Product.name, ProductSchema).createIndexes();
  console.log('Indexes of products:', (await connection.collection('products').indexes()).map((index) => index.name));
} finally {
  await connection.close();
}
