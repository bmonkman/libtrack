import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LibraryCard } from '../../library-cards/entities/library-card.entity';

export enum BookState {
  CHECKED_OUT = 'checked_out',
  FOUND = 'found',
  RETURNED = 'returned',
  OVERDUE = 'overdue',
}

@Entity()
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  isbn: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  pictureUrl: string;

  @Column({
    type: 'enum',
    enum: BookState,
    default: BookState.FOUND,
  })
  state: BookState;

  @ManyToOne(() => LibraryCard, { nullable: true })
  @JoinColumn({ name: 'library_card_id' })
  libraryCard: LibraryCard;
}
