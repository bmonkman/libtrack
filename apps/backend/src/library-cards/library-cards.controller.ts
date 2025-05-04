import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { LibraryCardsService } from './library-cards.service';
import { LibraryCard } from './entities/library-card.entity';

@Controller('library-cards')
export class LibraryCardsController {
  constructor(private readonly libraryCardsService: LibraryCardsService) {}

  @Get()
  async findAll(): Promise<LibraryCard[]> {
    return this.libraryCardsService.findAll();
  }

  @Post()
  async create(@Body() card: Partial<LibraryCard>): Promise<LibraryCard> {
    return this.libraryCardsService.create(card);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() card: Partial<LibraryCard>,
  ): Promise<LibraryCard> {
    return this.libraryCardsService.update(id, card);
  }
}
