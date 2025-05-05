import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Book } from '../../books/entities/book.entity';

@Entity()
export class LibraryCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  number: string;

  @Column()
  pin: string;

  @Column()
  displayName: string;

  @OneToMany(() => Book, (book) => book.libraryCard)
  books: Book[];
}
