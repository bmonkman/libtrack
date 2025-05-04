import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Book, BookState } from './entities/book.entity';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book)
    private booksRepository: Repository<Book>,
  ) {}

  async findAll(states?: BookState[]): Promise<Book[]> {
    if (states && states.length > 0) {
      return this.booksRepository.find({
        where: {
          state: In(states),
        },
      });
    }
    return this.booksRepository.find();
  }

  async updateStates(
    updates: { id: string; isbn: string; state: BookState }[],
  ): Promise<Book[]> {
    const updatedBooks: Book[] = [];

    for (const update of updates) {
      const book = await this.booksRepository.findOne({
        where: {
          id: update.id,
        },
      });
      if (book) {
        book.state = update.state;
        const updatedBook = await this.booksRepository.save(book);
        updatedBooks.push(updatedBook);
      }
    }

    return updatedBooks;
  }
}
