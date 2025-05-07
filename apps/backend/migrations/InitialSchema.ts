import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1746552849225 implements MigrationInterface {
  name = 'InitialSchema1746552849225';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types first
    await queryRunner.query(
      `CREATE TYPE "book_state_enum" AS ENUM('checked_out', 'found', 'returned', 'overdue')`
    );
    await queryRunner.query(
      `CREATE TYPE "authenticator_attachment_enum" AS ENUM('platform', 'cross-platform')`
    );
    await queryRunner.query(
      `CREATE TYPE "transport_enum" AS ENUM('usb', 'nfc', 'ble', 'internal')`
    );
    await queryRunner.query(`CREATE TYPE "library_system_enum" AS ENUM('nwpl')`);

    // Create tables
    await queryRunner.query(
      `CREATE TABLE "book" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isbn" character varying NOT NULL, "title" character varying NOT NULL, "picture_url" character varying, "state" "book_state_enum" NOT NULL DEFAULT 'found', "library_card_id" uuid, "user_id" uuid, "due_date" TIMESTAMP, CONSTRAINT "PK_book_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "library_card" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "number" character varying NOT NULL, "pin" character varying NOT NULL, "displayName" character varying NOT NULL, "system" "library_system_enum" NOT NULL DEFAULT 'nwpl', "user_id" uuid, CONSTRAINT "PK_library_card_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "passkey_credential" ("id" character varying NOT NULL, "public_key" character varying NOT NULL, "algorithm" character varying NOT NULL, "authenticator_attachment" "authenticator_attachment_enum" NOT NULL, "transports" "transport_enum"[] NOT NULL, "user_id" uuid, CONSTRAINT "PK_passkey_credential_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "app_user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, CONSTRAINT "PK_user_id" PRIMARY KEY ("id"))`
    );

    // Add foreign keys
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" ADD CONSTRAINT "FK_passkey_credential_user_id" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "book" ADD CONSTRAINT "FK_book_library_card_id" FOREIGN KEY ("library_card_id") REFERENCES "library_card"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "library_card" ADD CONSTRAINT "FK_library_card_user_id" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "book" ADD CONSTRAINT "FK_book_user_id" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    await queryRunner.query(`ALTER TABLE "book" DROP CONSTRAINT "FK_book_user_id"`);
    await queryRunner.query(`ALTER TABLE "library_card" DROP CONSTRAINT "FK_library_card_user_id"`);
    await queryRunner.query(`ALTER TABLE "book" DROP CONSTRAINT "FK_book_library_card_id"`);
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" DROP CONSTRAINT "FK_passkey_credential_user_id"`
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "passkey_credential"`);
    await queryRunner.query(`DROP TABLE "book"`);
    await queryRunner.query(`DROP TABLE "library_card"`);
    await queryRunner.query(`DROP TABLE "app_user"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE "transport_enum"`);
    await queryRunner.query(`DROP TYPE "authenticator_attachment_enum"`);
    await queryRunner.query(`DROP TYPE "book_state_enum"`);
    await queryRunner.query(`DROP TYPE "library_system_enum"`);
  }
}
