import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { LibraryCard } from './LibraryCard';
import { User } from './User';

// Where the book is. Whether it's overdue is a separate question, answered by comparing dueDate
// with today, so marking a book found never hides that it's late.
export enum BookState {
  CHECKED_OUT = 'checked_out', // borrowed, not located in the house yet
  FOUND = 'found', // borrowed and located
  RETURNED = 'returned', // no longer on the library card
}

@Entity()
@Index(['libraryCardId', 'checkoutId'], { unique: true, where: '"checkoutId" IS NOT NULL' })
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  isbn!: string;

  @Column()
  title!: string;

  // Display form, e.g. 'Raina Telgemeier' (the library sends 'Telgemeier, Raina')
  @Column({ nullable: true })
  author?: string;

  @Column({ nullable: true })
  pictureUrl?: string;

  @Column({
    type: 'enum',
    enum: BookState,
    default: BookState.FOUND,
  })
  state!: BookState;

  // Library due dates are calendar dates with no time ('YYYY-MM-DD'). A timestamp would be read
  // as UTC midnight, which is the previous afternoon in Vancouver.
  @Column({ type: 'date', nullable: true })
  dueDate?: string;

  // BiblioCommons' ID for this loan. The sync matches on it, so the same title borrowed on two
  // cards, or by two households, stays as separate rows.
  @Column({ nullable: true })
  checkoutId?: string;

  // The library's id for the title (shared by every copy); links a book to its lost charge
  @Column({ nullable: true })
  metadataId?: string;

  // Set while the library is charging for this book as lost. The book stays on the user's list
  // (it's somewhere in the house) instead of being marked returned.
  @Column({ type: 'integer', nullable: true })
  lostChargeCents?: number | null;

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
