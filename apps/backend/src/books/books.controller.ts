import { Controller, Get, Put, Body, Query } from '@nestjs/common';
import { BooksService } from './books.service';
import { Book, BookState } from './entities/book.entity';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  async findAll(@Query('states') states?: BookState[]): Promise<Book[]> {
    return this.booksService.findAll(states);
  }

  @Put('states')
  async updateStates(
    @Body()
    updates: { id: string; isbn: string; state: BookState }[],
  ): Promise<Book[]> {
    return this.booksService.updateStates(updates);
  }
}
