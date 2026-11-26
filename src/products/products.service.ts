import { ConflictException, Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, QueryFilter } from 'mongoose';
import { Product, type ProductDocument } from './product.schema.js';
import type { CreateProductDto, ListProductsQuery, UpdateProductDto } from './products.schemas.js';

export interface ProductPage {
  items: ProductDocument[];
  /** Pass it back as `cursor` for the next page; `null` on the last one. */
  nextCursor: string | null;
}

// Each sort orders by _id last, so products with the same price keep a fixed order.
const sorts = {
  '-createdAt': { field: 'createdAt', direction: -1 },
  price: { field: 'price', direction: 1 },
  '-price': { field: 'price', direction: -1 },
} as const satisfies Record<ListProductsQuery['sort'], unknown>;

@Injectable()
export class ProductsService implements OnModuleInit {
  constructor(@InjectModel(Product.name) private readonly productModel: Model<Product>) {}

  async onModuleInit() {
    // In development and tests, the model arrives with its indexes built (waitForModelInit in AppModule).
    // With autoIndex off (production), a release step builds them: refuse to start if it didn't.
    const { toCreate } = await this.productModel.diffIndexes();
    if (toCreate.length > 0) {
      throw new Error(`Missing indexes on products: ${JSON.stringify(toCreate)}. Run npm run db:indexes.`);
    }
  }

  create(dto: CreateProductDto): Promise<ProductDocument> {
    return this.productModel.create(dto);
  }

  async findOne(id: string): Promise<ProductDocument> {
    return (await this.productModel.findById(id)) ?? notFound();
  }

  async update(id: string, { version, ...changes }: UpdateProductDto): Promise<ProductDocument> {
    // One conditional statement: it matches only while the product is still at the
    // version the client read, and $set writes only the fields the client sent.
    const product = await this.productModel.findOneAndUpdate(
      { _id: id, version },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: 'after', runValidators: true },
    );
    if (product) {
      return product;
    }
    // Nothing matched: either there's no such product, or someone changed it first.
    if (!(await this.productModel.exists({ _id: id }))) {
      notFound();
    }
    throw new ConflictException(`Product has changed since version ${version}`, { errorCode: 'VERSION_CONFLICT' });
  }

  async remove(id: string): Promise<void> {
    const { deletedCount } = await this.productModel.deleteOne({ _id: id });
    if (deletedCount === 0) {
      notFound();
    }
  }

  async list({ category, minPrice, maxPrice, inStock, sort, limit, cursor }: ListProductsQuery): Promise<ProductPage> {
    const { field, direction } = sorts[sort];
    // Built field by field from validated values: no request object is ever spread into a filter.
    const filter: QueryFilter<Product> = {};
    if (category !== undefined) {
      filter.category = category;
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = { $gte: minPrice ?? 0, $lte: maxPrice ?? Number.MAX_SAFE_INTEGER };
    }
    if (inStock !== undefined) {
      filter.stock = inStock ? { $gt: 0 } : 0;
    }
    if (cursor) {
      // The products after the cursor in sort order: a later sort value, or the same one and a later _id.
      const [lastValue, lastId] = cursor;
      const value = field === 'createdAt' ? new Date(lastValue) : lastValue;
      const after = direction === 1 ? '$gt' : '$lt';
      filter.$and = [
        { [field]: { [direction === 1 ? '$gte' : '$lte']: value } },
        { $or: [{ [field]: { [after]: value } }, { _id: { [after]: lastId } }] },
      ];
    }

    // One more than a page: if it comes back, there's a next page.
    const found = await this.productModel
      .find(filter)
      .sort({ [field]: direction, _id: direction })
      .limit(limit + 1);
    const items = found.slice(0, limit);
    const last = items.at(-1);
    const nextCursor =
      found.length > limit && last
        ? Buffer.from(JSON.stringify([+last[field], last.id])).toString('base64url')
        : null;
    return { items, nextCursor };
  }
}

function notFound(): never {
  throw new NotFoundException('Product not found');
}
