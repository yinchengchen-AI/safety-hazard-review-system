/**
 * Pagination limits enforced application-wide. Direct
 * ``@Query('page_size')`` parameters that aren't constrained
 * with ``@Max(MAX_PAGE_SIZE)`` can be coerced by an attacker into
 * ``page_size=1000000`` which would DoS the DB / OOM the process.
 */
import { Type, Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export function PageSize(max = MAX_PAGE_SIZE) {
  return Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  });
}

export class ListPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @PageSize()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  page_size?: number;
}
