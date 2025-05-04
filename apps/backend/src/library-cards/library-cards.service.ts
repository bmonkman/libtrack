import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LibraryCard } from './entities/library-card.entity';

@Injectable()
export class LibraryCardsService {
  constructor(
    @InjectRepository(LibraryCard)
    private libraryCardsRepository: Repository<LibraryCard>,
  ) {}

  async findAll(): Promise<LibraryCard[]> {
    return this.libraryCardsRepository.find();
  }

  async create(card: Partial<LibraryCard>): Promise<LibraryCard> {
    const newCard = this.libraryCardsRepository.create(card);
    return this.libraryCardsRepository.save(newCard);
  }

  async update(id: string, card: Partial<LibraryCard>): Promise<LibraryCard> {
    await this.libraryCardsRepository.update(id, card);
    const updatedCard = await this.libraryCardsRepository.findOne({
      where: {
        id,
      },
    });
    if (!updatedCard) {
      throw new Error('Library card not found');
    }
    return updatedCard;
  }
}
