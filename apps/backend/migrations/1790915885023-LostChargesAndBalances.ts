import { MigrationInterface, QueryRunner } from 'typeorm';

export class LostChargesAndBalances1790915885023 implements MigrationInterface {
  name = 'LostChargesAndBalances1790915885023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "library_card" ADD "balanceCents" integer`);
    await queryRunner.query(
      `ALTER TABLE "library_card" ADD "balanceUpdatedAt" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(`ALTER TABLE "book" ADD "metadataId" character varying`);
    await queryRunner.query(`ALTER TABLE "book" ADD "lostChargeCents" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "book" DROP COLUMN "lostChargeCents"`);
    await queryRunner.query(`ALTER TABLE "book" DROP COLUMN "metadataId"`);
    await queryRunner.query(`ALTER TABLE "library_card" DROP COLUMN "balanceUpdatedAt"`);
    await queryRunner.query(`ALTER TABLE "library_card" DROP COLUMN "balanceCents"`);
  }
}
