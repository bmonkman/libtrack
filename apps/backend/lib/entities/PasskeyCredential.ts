import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';

@Entity()
export class PasskeyCredential {
  // base64url credential ID, as reported by the authenticator
  @PrimaryColumn()
  id!: string;

  // base64url-encoded COSE public key
  @Column()
  publicKey!: string;

  // WebAuthn signature counters are uint32, which overflows Postgres integer
  @Column({
    type: 'bigint',
    default: 0,
    transformer: { to: (value: number) => value, from: (value: string) => Number(value) },
  })
  counter!: number;

  @Column('simple-array')
  transports!: string[];

  // 'singleDevice' or 'multiDevice' (synced passkey)
  @Column()
  deviceType!: string;

  @Column()
  backedUp!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt?: Date;

  @Column()
  userId!: string;

  @ManyToOne(() => User, (user) => user.credentials)
  @JoinColumn({ name: 'userId' })
  user?: User;
}
