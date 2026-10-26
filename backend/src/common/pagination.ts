import { BadRequestException } from '@nestjs/common';

export const MAX_PAGE_SIZE = 100;

export type Pagination = {
  page: number;
  pageSize: number;
  skip: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function parsePagination(pageValue?: string, pageSizeValue?: string): Pagination | undefined {
  if (pageValue === undefined && pageSizeValue === undefined) return undefined;

  const parsePositiveInteger = (value: string | undefined, name: string, fallback: number) => {
    if (value === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(value)) {
      throw new BadRequestException(`${name} debe ser un número entero mayor que cero.`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      throw new BadRequestException(`${name} está fuera del rango permitido.`);
    }
    return parsed;
  };

  const page = parsePositiveInteger(pageValue, 'page', 1);
  const pageSize = parsePositiveInteger(pageSizeValue, 'pageSize', 25);
  if (pageSize > MAX_PAGE_SIZE) {
    throw new BadRequestException(`pageSize no puede ser mayor que ${MAX_PAGE_SIZE}.`);
  }

  const skip = (page - 1) * pageSize;
  if (!Number.isSafeInteger(skip)) {
    throw new BadRequestException('La página solicitada está fuera del rango permitido.');
  }

  return { page, pageSize, skip };
}

export function paginatedResult<T>(
  items: T[],
  total: number,
  pagination: Pagination,
): PaginatedResult<T> {
  return {
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(total / pagination.pageSize),
  };
}
