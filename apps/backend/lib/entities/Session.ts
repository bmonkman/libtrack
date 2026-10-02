import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './User';

// One signed-in device. The browser holds a random token; only its SHA-256 is stored here, so a
// copy of this table can't be used to sign in.
@Entity()
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  tokenHash!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  lastUsedAt!: Date;

  // Moves forward as the session is used, so it only ends after a long stretch of not using it
  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
}
