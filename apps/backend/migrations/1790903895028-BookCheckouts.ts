import { MigrationInterface, QueryRunner } from 'typeorm';

export class BookCheckouts1790903895028 implements MigrationInterface {
  name = 'BookCheckouts1790903895028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "book" ADD "checkoutId" character varying`);
    await queryRunner.query(`ALTER TABLE "book" ADD "author" character varying`);

    // 'overdue' stops being a state (it's worked out from dueDate). Those books are still out.
    await queryRunner.query(`UPDATE "book" SET "state" = 'checked_out' WHERE "state" = 'overdue'`);
    await queryRunner.query(
      `ALTER TYPE "public"."book_state_enum" RENAME TO "book_state_enum_old"`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."book_state_enum" AS ENUM('checked_out', 'found', 'returned')`
    );
    await queryRunner.query(`ALTER TABLE "book" ALTER COLUMN "state" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "book" ALTER COLUMN "state" TYPE "public"."book_state_enum" USING "state"::"text"::"public"."book_state_enum"`
    );
    await queryRunner.query(`ALTER TABLE "book" ALTER COLUMN "state" SET DEFAULT 'found'`);
    await queryRunner.query(`DROP TYPE "public"."book_state_enum_old"`);

    // Existing values are all midnight (the sync wrote UTC-midnight timestamps), so the cast keeps
    // the library's due day. Converted in place rather than dropped and re-added.
    await queryRunner.query(
      `ALTER TABLE "book" ALTER COLUMN "dueDate" TYPE date USING "dueDate"::date`
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_245a6f6efe71ce6eaeac5b7d46" ON "book" ("libraryCardId", "checkoutId") WHERE "checkoutId" IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_245a6f6efe71ce6eaeac5b7d46"`);
    await queryRunner.query(
      `ALTER TABLE "book" ALTER COLUMN "dueDate" TYPE TIMESTAMP USING "dueDate"::timestamp`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."book_state_enum_old" AS ENUM('checked_out', 'found', 'returned', 'overdue')`
    );
    await queryRunner.query(`ALTER TABLE "book" ALTER COLUMN "state" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "book" ALTER COLUMN "state" TYPE "public"."book_state_enum_old" USING "state"::"text"::"public"."book_state_enum_old"`
    );
    await queryRunner.query(`ALTER TABLE "book" ALTER COLUMN "state" SET DEFAULT 'found'`);
    await queryRunner.query(`DROP TYPE "public"."book_state_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."book_state_enum_old" RENAME TO "book_state_enum"`
    );
    await queryRunner.query(`ALTER TABLE "book" DROP COLUMN "author"`);
    await queryRunner.query(`ALTER TABLE "book" DROP COLUMN "checkoutId"`);
  }
}
