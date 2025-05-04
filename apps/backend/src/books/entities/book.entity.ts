import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

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
}
