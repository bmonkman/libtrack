import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasskeyVerification1790899790866 implements MigrationInterface {
  name = 'PasskeyVerification1790899790866';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Credentials saved before this migration stored the credential ID in place of the public
    // key, so they can never pass signature verification. Their owners add a new passkey.
    await queryRunner.query(`DELETE FROM "passkey_credential"`);
    await queryRunner.query(
      `CREATE TYPE "public"."web_authn_challenge_purpose_enum" AS ENUM('register', 'add_passkey', 'login')`
    );
    await queryRunner.query(
      `CREATE TABLE "web_authn_challenge" ("challenge" character varying NOT NULL, "purpose" "public"."web_authn_challenge_purpose_enum" NOT NULL, "userId" uuid, "userName" character varying, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_18b4e6b0aa4e8347a9d5d8361f9" PRIMARY KEY ("challenge"))`
    );
    await queryRunner.query(`ALTER TABLE "passkey_credential" DROP COLUMN "algorithm"`);
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" DROP COLUMN "authenticatorAttachment"`
    );
    await queryRunner.query(`DROP TYPE "public"."passkey_credential_authenticatorattachment_enum"`);
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" ADD "counter" bigint NOT NULL DEFAULT '0'`
    );
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" ADD "deviceType" character varying NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "passkey_credential" ADD "backedUp" boolean NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`
    );
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" ADD "lastUsedAt" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" DROP CONSTRAINT "FK_5f47d56fa2bae22e145c61e5b49"`
    );
    await queryRunner.query(`ALTER TABLE "passkey_credential" ALTER COLUMN "userId" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" ADD CONSTRAINT "FK_5f47d56fa2bae22e145c61e5b49" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The old columns can't be backfilled from new credentials, and they come back as NOT NULL,
    // so rolling back removes passkeys just as going forward did
    await queryRunner.query(`DELETE FROM "passkey_credential"`);
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" DROP CONSTRAINT "FK_5f47d56fa2bae22e145c61e5b49"`
    );
    await queryRunner.query(`ALTER TABLE "passkey_credential" ALTER COLUMN "userId" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" ADD CONSTRAINT "FK_5f47d56fa2bae22e145c61e5b49" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(`ALTER TABLE "passkey_credential" DROP COLUMN "lastUsedAt"`);
    await queryRunner.query(`ALTER TABLE "passkey_credential" DROP COLUMN "createdAt"`);
    await queryRunner.query(`ALTER TABLE "passkey_credential" DROP COLUMN "backedUp"`);
    await queryRunner.query(`ALTER TABLE "passkey_credential" DROP COLUMN "deviceType"`);
    await queryRunner.query(`ALTER TABLE "passkey_credential" DROP COLUMN "counter"`);
    await queryRunner.query(
      `CREATE TYPE "public"."passkey_credential_authenticatorattachment_enum" AS ENUM('platform', 'cross-platform')`
    );
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" ADD "authenticatorAttachment" "public"."passkey_credential_authenticatorattachment_enum" NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "passkey_credential" ADD "algorithm" character varying NOT NULL`
    );
    await queryRunner.query(`DROP TABLE "web_authn_challenge"`);
    await queryRunner.query(`DROP TYPE "public"."web_authn_challenge_purpose_enum"`);
  }
}
