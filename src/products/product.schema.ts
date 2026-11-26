import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({
  timestamps: true, // createdAt and updatedAt, set by Mongoose on every write
  versionKey: false, // no __v: `version` below is the one clients see
  toJSON: {
    virtuals: true, // adds `id`, the ObjectId as a string
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret._id;
      return ret;
    },
  },
})
export class Product {
  @Prop({ required: true })
  sku: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true })
  category: string;

  // Money in integer cents: no floating-point rounding.
  @Prop({ required: true, min: 1 })
  price: number;

  @Prop({ required: true, min: 0 })
  stock: number;

  // Incremented by every update; a client sends back the one it read.
  @Prop({ required: true, default: 1 })
  version: number;

  createdAt: Date;
  updatedAt: Date;
}

export type ProductDocument = HydratedDocument<Product>;

export const ProductSchema = SchemaFactory.createForClass(Product);

// Two products can't share a SKU, however many requests race to create one.
ProductSchema.index({ sku: 1 }, { unique: true });
// One index per filter and sort the list allows, with _id last as the tiebreaker.
ProductSchema.index({ createdAt: -1, _id: -1 });
ProductSchema.index({ price: 1, _id: 1 });
ProductSchema.index({ category: 1, createdAt: -1, _id: -1 });
ProductSchema.index({ category: 1, price: 1, _id: 1 });
