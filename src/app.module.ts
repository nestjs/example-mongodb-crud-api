import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { createObserveModule } from '@nestjs/observe';
import { DuplicateKeyFilter } from './common/duplicate-key.filter.js';
import { envSchema, type Env } from './config.js';
import { HealthModule } from './health/health.module.js';
import { ProductsModule } from './products/products.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // First, so it shuts down last and still sends what the other modules did.
    ObserveModule.forRoot({
      // Empty until `npx @nestjs/observe link` writes the key pair into .env: the SDK then sends nothing.
      appKey: process.env.OBSERVE_APP_KEY ?? '',
      appSecret: process.env.OBSERVE_APP_SECRET ?? '',
      serviceId: 'products-api',
    }),
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
        // How long a query waits for a reachable server before it fails (the driver's default is 30s).
        serverSelectionTimeoutMS: 5_000,
        // Builds the schemas' indexes at startup. Production builds them in a release step instead.
        autoIndex: config.get('NODE_ENV', { infer: true }) !== 'production',
      }),
    }),
    ProductsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
    { provide: APP_FILTER, useClass: DuplicateKeyFilter },
  ],
})
export class AppModule {}
