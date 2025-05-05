import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1746384729932 implements MigrationInterface {
  name = 'InitialSchema1746384729932';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."book_state_enum" AS ENUM('checked_out', 'found', 'returned', 'overdue')`,
    );
    await queryRunner.query(
      `CREATE TABLE "library_card" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "number" character varying NOT NULL, "pin" character varying NOT NULL, "display_name" character varying NOT NULL, CONSTRAINT "PK_9ba59eb31bc63e22aa775c694be" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "book" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isbn" character varying NOT NULL, "title" character varying NOT NULL, "pictureUrl" character varying, "state" "public"."book_state_enum" NOT NULL DEFAULT 'found', "library_card_id" uuid, CONSTRAINT "PK_a3afef72ec8f80e6e5c310b28a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "book" ADD CONSTRAINT "FK_9ba59eb31bc63e22aa775c694be" FOREIGN KEY ("library_card_id") REFERENCES "library_card"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "book" DROP CONSTRAINT "FK_9ba59eb31bc63e22aa775c694be"`,
    );
    await queryRunner.query(`DROP TABLE "book"`);
    await queryRunner.query(`DROP TABLE "library_card"`);
    await queryRunner.query(`DROP TYPE "public"."book_state_enum"`);
  }
}
