import { getConnectionToken } from '@nestjs/mongoose';
import { NodeAdapter, type NestNodeApplication } from '@nestjs/platform-node';
import { Test } from '@nestjs/testing';
import { createConnection } from 'mongoose';
import { AppModule } from '../src/app.module.js';

/**
 * The real AppModule, on a database of its own: `<database in TEST_MONGODB_URI>_<name>`,
 * emptied first. Each test file passes its own name, so files run in parallel.
 */
export async function createTestApp(name: string): Promise<NestNodeApplication> {
  const server = await createConnection(process.env.TEST_MONGODB_URI!).asPromise();
  const connection = server.useDb(`${server.name}_${name}`);
  await connection.dropDatabase();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(getConnectionToken())
    .useValue(connection)
    .compile();
  const app = moduleRef.createNestApplication<NestNodeApplication>(new NodeAdapter());
  // Closing the application closes the connection too.
  return app.init();
}
