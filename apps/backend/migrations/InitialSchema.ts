import { MigrationInterface, QueryRunner } from 'typeorm';

// Mirrors the production schema as it actually exists (it was shaped by TypeORM synchronize, so
// columns are camelCase). Production already records this migration as run; it only executes
// against a fresh database.
export class InitialSchema1746552849225 implements MigrationInterface {
  name = 'InitialSchema1746552849225';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(
      `CREATE TYPE "book_state_enum" AS ENUM('checked_out', 'found', 'returned', 'overdue')`
    );
    await queryRunner.query(`CREATE TYPE "library_card_system_enum" AS ENUM('nwpl')`);
    await queryRunner.query(
      `CREATE TYPE "passkey_credential_authenticatorattachment_enum" AS ENUM('platform', 'cross-platform')`
    );

    await queryRunner.query(
      `CREATE TABLE "app_user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, CONSTRAINT "PK_user_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "library_card" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "number" character varying NOT NULL, "pin" character varying NOT NULL, "displayName" character varying NOT NULL, "system" "library_card_system_enum" NOT NULL DEFAULT 'nwpl', "userId" uuid, CONSTRAINT "PK_library_card_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "book" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isbn" character varying NOT NULL, "title" character varying NOT NULL, "state" "book_state_enum" NOT NULL DEFAULT 'found', "pictureUrl" character varying, "dueDate" TIMESTAMP, "libraryCardId" uuid, "userId" uuid, CONSTRAINT "PK_book_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "passkey_credential" ("id" character varying NOT NULL, "algorithm" character varying NOT NULL, "publicKey" character varying NOT NULL, "authenticatorAttachment" "passkey_credential_authenticatorattachment_enum" NOT NULL, "userId" uuid, "transports" text NOT NULL, CONSTRAINT "PK_passkey_credential_id" PRIMARY KEY ("id"))`
    );

    await queryRunner.query(
      `ALTER TABLE "book" ADD CONSTRAINT "FK_04f66cf2a34f8efc5dcd9803693" FOREIGN KEY ("userId") REFERENCES "app_user"("id")`
    );
    await queryRunner.query(
      `ALTER TABLE "library_card" ADD CONSTRAINT "FK_3d6e54d35a90198b16a7640da43" FOREIGN KEY ("userId") REFERENCES "app_user"("id")`
    );
    await queryRunner.query(
      `ALTER TABLE "book" ADD CONSTRAINT "FK_5b941c9174b28fd8c0f1146a4e0" FOREIGN KEY ("libraryCardId") REFERENCES "library_card"("id")`
    );
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" ADD CONSTRAINT "FK_5f47d56fa2bae22e145c61e5b49" FOREIGN KEY ("userId") REFERENCES "app_user"("id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "passkey_credential"`);
    await queryRunner.query(`DROP TABLE "book"`);
    await queryRunner.query(`DROP TABLE "library_card"`);
    await queryRunner.query(`DROP TABLE "app_user"`);
    await queryRunner.query(`DROP TYPE "passkey_credential_authenticatorattachment_enum"`);
    await queryRunner.query(`DROP TYPE "library_card_system_enum"`);
    await queryRunner.query(`DROP TYPE "book_state_enum"`);
  }
}
