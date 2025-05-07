import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { LibraryCard } from './LibraryCard';
import { User } from './User';

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
  dueDate?: Date;

  @Column({ nullable: true })
  libraryCardId?: string;

  @ManyToOne(() => LibraryCard, { nullable: true })
  @JoinColumn({ name: 'libraryCardId' })
  libraryCard?: LibraryCard;

  @Column({ nullable: true })
  userId?: string;

  @ManyToOne(() => User, (user) => user.books, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  constructor(isbn: string, title: string, pictureUrl?: string) {
    this.isbn = isbn;
    this.title = title;
    this.pictureUrl = pictureUrl;
    this.state = BookState.FOUND;
  }
}
