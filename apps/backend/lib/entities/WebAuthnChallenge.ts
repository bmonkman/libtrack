import { Entity, PrimaryColumn, Column } from 'typeorm';

export enum ChallengePurpose {
  REGISTER = 'register',
  ADD_PASSKEY = 'add_passkey',
  LOGIN = 'login',
}

// Challenges live in the database rather than memory because each serverless instance has its
// own memory, and the options request and the verify request can land on different instances.
@Entity()
export class WebAuthnChallenge {
  @PrimaryColumn()
  challenge!: string;

  @Column({ type: 'enum', enum: ChallengePurpose })
  purpose!: ChallengePurpose;

  // For REGISTER: the id the new user will get. For ADD_PASSKEY: the signed-in user.
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  // For REGISTER: the name the new user asked for
  @Column({ nullable: true })
  userName?: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
}
