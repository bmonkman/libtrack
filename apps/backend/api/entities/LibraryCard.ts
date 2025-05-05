import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum LibrarySystem {
	NWPL = 'nwpl'
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
		default: LibrarySystem.NWPL
	})
	system!: LibrarySystem;

	constructor(number: string, pin: string, displayName: string, system: LibrarySystem = LibrarySystem.NWPL) {
		this.number = number;
		this.pin = pin;
		this.displayName = displayName;
		this.system = system;
	}
}
