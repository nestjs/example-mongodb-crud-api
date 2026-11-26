import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createProductSchema,
  listProductsQuerySchema,
  objectId,
  updateProductSchema,
  type CreateProductDto,
  type ListProductsQuery,
  type UpdateProductDto,
} from './products.schemas.js';
import { ProductsService } from './products.service.js';

const productId = { schema: objectId };

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query({ schema: listProductsQuerySchema }) query: ListProductsQuery) {
    return this.productsService.list(query);
  }

  @Get(':id')
  findOne(@Param('id', productId) id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body({ schema: createProductSchema }) dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', productId) id: string, @Body({ schema: updateProductSchema }) dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', productId) id: string) {
    return this.productsService.remove(id);
  }
}
