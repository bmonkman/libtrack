import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { LibraryCard } from './LibraryCard';

export enum BookState {
  CHECKED_OUT = 'checked_out',
  FOUND = 'found',
  RETURNED = 'returned',
  OVERDUE = 'overdue',
}

@Entity()
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  isbn!: string;

  @Column()
  title!: string;

  @Column({ nullable: true })
  pictureUrl?: string;

  @Column({
    type: 'enum',
    enum: BookState,
    default: BookState.FOUND,
  })
  state!: BookState;

  @Column({ nullable: true })
  libraryCardId?: string;

  @ManyToOne(() => LibraryCard, { nullable: true })
  @JoinColumn({ name: 'libraryCardId' })
  libraryCard?: LibraryCard;

  constructor(isbn: string, title: string, pictureUrl?: string) {
    this.isbn = isbn;
    this.title = title;
    this.pictureUrl = pictureUrl;
    this.state = BookState.FOUND;
  }
}
