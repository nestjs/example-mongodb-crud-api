import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NodeAdapter, type NestNodeApplication } from '@nestjs/platform-node';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule, ObserveInstrument } from './app.module.js';
import type { Env } from './config.js';

const production = process.env.NODE_ENV === 'production';
const app = await NestFactory.create<NestNodeApplication>(AppModule, new NodeAdapter(), {
  instrument: ObserveInstrument,
  // One JSON object per line in production; readable text in development.
  logger: new ConsoleLogger({ json: production }),
});
app.useSecurityHeaders();
app.enableShutdownHooks();

const config = app.get<ConfigService<Env, true>>(ConfigService);
app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }) });

const document = new DocumentBuilder().setTitle('Products API').setVersion('1.0').build();
SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, document));

await app.listen(config.get('PORT', { infer: true }));
