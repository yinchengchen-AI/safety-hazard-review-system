import { ArgumentMetadata, BadRequestException, Injectable, Optional, ParseIntPipeOptions } from '@nestjs/common';
import { ParseIntPipe } from '@nestjs/common';

/**
 * ParseIntPipe with a hard upper bound so a request like
 * ``?page_size=1000000`` can't ask the DB to materialize
 * millions of rows.
 */
@Injectable()
export class MaxIntPipe extends ParseIntPipe {
  constructor(@Optional() options: ParseIntPipeOptions = {}, @Optional() private readonly max: number = 100) {
    super(options);
  }

  async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
    const n = await super.transform(value, metadata);
    if (n > this.max) {
      throw new BadRequestException(`Value exceeds maximum of ${this.max}`);
    }
    if (n < 1) {
      throw new BadRequestException(`Value must be at least 1`);
    }
    return n;
  }
}
