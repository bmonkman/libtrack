import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

export enum LibrarySystem {
  NWPL = 'nwpl',
}

@Entity()
export class LibraryCard {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  number!: string;

  @Column()
  pin!: string;

  @Column()
  displayName!: string;

  @Column({
    type: 'enum',
    enum: LibrarySystem,
    default: LibrarySystem.NWPL,
  })
  system!: LibrarySystem;

  // What the library says the card owes: charges minus credits, from the last successful sync.
  // Null until a sync has read it.
  @Column({ type: 'integer', nullable: true })
  balanceCents?: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  balanceUpdatedAt?: Date | null;

  @Column({ nullable: true })
  userId?: string;

  @ManyToOne(() => User, (user) => user.libraryCards)
  @JoinColumn({ name: 'userId' })
  user?: User;

  constructor(
    number: string,
    pin: string,
    displayName: string,
    system: LibrarySystem = LibrarySystem.NWPL
  ) {
    this.number = number;
    this.pin = pin;
    this.displayName = displayName;
    this.system = system;
  }
}
