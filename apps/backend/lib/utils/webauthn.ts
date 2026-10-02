import { decodeClientDataJSON } from '@simplewebauthn/server/helpers';
import { LessThan } from 'typeorm';
import { AppDataSource } from '../ormconfig';
import { ChallengePurpose, WebAuthnChallenge } from '../entities/WebAuthnChallenge';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export const RP_NAME = 'LibTrack';

// The RP ID is the frontend's domain and the origin is the frontend's URL; both must match what
// the browser saw, so they come from config rather than the API request's Host header.
export const getRelyingParty = () => ({
  rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
});

export async function saveChallenge(
  challenge: string,
  purpose: ChallengePurpose,
  user: { userId?: string; userName?: string } = {}
): Promise<void> {
  const repository = AppDataSource.getRepository(WebAuthnChallenge);
  await repository.delete({ expiresAt: LessThan(new Date()) });
  await repository.insert({
    challenge,
    purpose,
    userId: user.userId,
    userName: user.userName,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
}

// Deletes the challenge the browser signed and returns it, so each challenge can be used once.
// Returns null when it is unknown, expired, or was issued for a different purpose.
export async function consumeChallenge(
  clientDataJSON: string,
  purpose: ChallengePurpose
): Promise<WebAuthnChallenge | null> {
  let challenge: string;
  try {
    challenge = decodeClientDataJSON(clientDataJSON).challenge;
  } catch {
    return null;
  }

  const result = await AppDataSource.createQueryBuilder()
    .delete()
    .from(WebAuthnChallenge)
    .where('challenge = :challenge AND purpose = :purpose AND "expiresAt" > now()', {
      challenge,
      purpose,
    })
    .returning('*')
    .execute();

  return (result.raw as WebAuthnChallenge[])[0] ?? null;
}
