import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { CatalogService } from './catalog.service';

class CreateCategoryDto { @IsNotEmpty() name: string; }
class ProductVariantInputDto {
  @IsOptional() @IsInt() id?: number;
  @IsNotEmpty() @IsString() size: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() height?: string;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @IsInt() @Min(0) warrantyYears?: number;
  @IsOptional() @IsInt() @Min(0) minStock?: number;
  @IsNotEmpty() @IsString() sku: string;
}
class CreateProductDto {
  @IsInt() categoryId: number;
  @IsNotEmpty() name: string;
  @IsNotEmpty() sku: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() warrantySeal?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductVariantInputDto)
  variants?: ProductVariantInputDto[];
}
class UpdateProductDto {
  @IsOptional() @IsInt() categoryId?: number;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() warrantySeal?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() isActive?: boolean;
}
class CreateVariantDto {
  @IsInt() productId: number;
  @IsNotEmpty() size: string;
  @IsOptional() type?: string;
  @IsOptional() color?: string;
  @IsOptional() @IsString() height?: string;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @IsInt() @Min(0) warrantyYears?: number;
  @IsOptional() @IsInt() @Min(0) minStock?: number;
  @IsOptional() @IsInt() maxStock?: number;
  @IsNotEmpty() sku: string;
}
class UpdateVariantDto {
  @IsOptional() size?: string;
  @IsOptional() type?: string;
  @IsOptional() color?: string;
  @IsOptional() @IsString() height?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @IsInt() @Min(0) warrantyYears?: number;
  @IsOptional() @IsInt() @Min(0) minStock?: number;
  @IsOptional() @IsInt() maxStock?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() sku?: string;
}
class SyncProductVariantsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ProductVariantInputDto)
  variants: ProductVariantInputDto[];
}

@ApiTags('Catálogo')
@ApiBearerAuth('JWT')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() { return this.catalog.categories(); }

  @Post('categories')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  createCategory(@Body() dto: CreateCategoryDto) { return this.catalog.createCategory(dto); }

  @Get('products')
  products(@Query('search') search?: string) {
    const cleanSearch = typeof search === 'string' ? search.trim().slice(0, 100) : undefined;
    return this.catalog.products(cleanSearch);
  }


  @Get('seller')
  @Roles(Role.VENDEDOR)
  sellerCatalog(@Req() req: any) {
    return this.catalog.sellerCatalog(req.user);
  }

  @Get('products/:id')
  product(@Param('id', ParseIntPipe) id: number) { return this.catalog.product(id); }

  @Post('products')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  createProduct(@Body() dto: CreateProductDto) { return this.catalog.createProduct(dto); }

  @Patch('products/:id')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  updateProduct(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) { return this.catalog.updateProduct(id, dto); }

  @Patch('products/:id/variants')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  syncProductVariants(@Param('id', ParseIntPipe) id: number, @Body() dto: SyncProductVariantsDto) {
    return this.catalog.syncProductVariants(id, dto.variants);
  }

  @Post('variants')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  createVariant(@Body() dto: CreateVariantDto) { return this.catalog.createVariant(dto); }

  @Patch('variants/:id')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  updateVariant(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVariantDto) {
    return this.catalog.updateVariant(id, dto);
  }
}
