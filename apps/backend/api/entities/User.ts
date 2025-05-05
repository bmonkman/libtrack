import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { PasskeyCredential } from './PasskeyCredential';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @OneToMany(() => PasskeyCredential, (credential) => credential.user)
  credentials!: PasskeyCredential[];

  constructor(name: string) {
    this.name = name;
  }
}
