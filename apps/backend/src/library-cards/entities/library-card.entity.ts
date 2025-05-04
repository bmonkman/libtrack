import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class LibraryCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  number: string;

  @Column()
  pin: string;
}
