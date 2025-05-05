import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class LibraryCard {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  number!: string;

  @Column()
  pin!: string;

  constructor(number: string, pin: string) {
    this.number = number;
    this.pin = pin;
  }
}
