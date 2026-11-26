import { ConflictException, Catch, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { mongo } from 'mongoose';

const DUPLICATE_KEY = 11000;

/** A unique index refused the write: a 409 that names the field, rather than a 500. */
@Catch(mongo.MongoServerError)
export class DuplicateKeyFilter extends BaseExceptionFilter {
  catch(error: mongo.MongoServerError, host: ArgumentsHost) {
    if (error.code !== DUPLICATE_KEY) {
      // Any other database error is still a 500, and logged as one.
      return super.catch(error, host);
    }
    // keyValue holds the values the index refused, e.g. { sku: 'KB-001' }.
    const fields = Object.keys(error.keyValue ?? {});
    const message = `This ${fields.join(', ') || 'key'} is already taken`;
    super.catch(new ConflictException(message, { errorCode: 'DUPLICATE_KEY' }), host);
  }
}
