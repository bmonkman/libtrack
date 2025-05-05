import { Entity, PrimaryColumn, Column, ManyToOne } from 'typeorm';
import { User } from './User';

export enum AuthenticatorAttachment {
  PLATFORM = 'platform',
  CROSS_PLATFORM = 'cross-platform',
}

export enum Transport {
  USB = 'usb',
  NFC = 'nfc',
  BLE = 'ble',
  INTERNAL = 'internal',
}

@Entity()
export class PasskeyCredential {
  @PrimaryColumn()
  id!: string;

  @Column()
  publicKey!: string;

  @Column()
  algorithm!: string;

  @Column({
    type: 'enum',
    enum: AuthenticatorAttachment,
  })
  authenticatorAttachment!: AuthenticatorAttachment;

  @Column('simple-array')
  transports!: Transport[];

  @ManyToOne(() => User, (user) => user.credentials)
  user!: User;

  constructor(
    id: string,
    publicKey: string,
    algorithm: string,
    authenticatorAttachment: AuthenticatorAttachment,
    transports: Transport[],
    user: User
  ) {
    this.id = id;
    this.publicKey = publicKey;
    this.algorithm = algorithm;
    this.authenticatorAttachment = authenticatorAttachment;
    this.transports = transports;
    this.user = user;
  }
}
