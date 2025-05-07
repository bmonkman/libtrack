import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { PasskeyCredential } from './PasskeyCredential';
import { LibraryCard } from './LibraryCard';
import { Book } from './Book';

@Entity('app_user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @OneToMany(() => PasskeyCredential, (credential) => credential.user)
  credentials!: PasskeyCredential[];

  @OneToMany(() => LibraryCard, (libraryCard) => libraryCard.user)
  libraryCards!: LibraryCard[];

  @OneToMany(() => Book, (book) => book.user)
  books!: Book[];

  constructor(name: string) {
    this.name = name;
  }
}
