import { VercelRequest, VercelResponse } from '@vercel/node';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  VerifiedRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { Not } from 'typeorm';
import { v4 as uuidv4, parse as uuidParse } from 'uuid';
import { AppDataSource } from '../lib/ormconfig';
import { User } from '../lib/entities/User';
import { PasskeyCredential } from '../lib/entities/PasskeyCredential';
import { Session } from '../lib/entities/Session';
import { ChallengePurpose } from '../lib/entities/WebAuthnChallenge';
import { createSession, requireAuth } from '../lib/utils/auth';
import { consumeChallenge, getRelyingParty, RP_NAME, saveChallenge } from '../lib/utils/webauthn';
import { handleCors } from '../lib/utils/utils';

const userRepository = AppDataSource.getRepository(User);
const credentialRepository = AppDataSource.getRepository(PasskeyCredential);
const sessionRepository = AppDataSource.getRepository(Session);

// Only what the frontend needs; never the user's relations (library cards carry PINs)
const toPublicUser = (user: User) => ({ id: user.id, name: user.name });

const authResult = async (user: User) => ({
  user: toPublicUser(user),
  token: await createSession(user.id),
});

async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string
): Promise<VerifiedRegistrationResponse | null> {
  const { rpID, origin } = getRelyingParty();
  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    return verification.verified ? verification : null;
  } catch (error) {
    console.error('Passkey registration verification failed:', error);
    return null;
  }
}

function newCredential(
  userId: string,
  registrationInfo: NonNullable<VerifiedRegistrationResponse['registrationInfo']>
): PasskeyCredential {
  const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;
  return credentialRepository.create({
    id: credential.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    userId,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    // e.g. /api/auth/passkeys/<id> -> route 'passkeys', resourceId '<id>'
    const [route, resourceId] = new URL(req.url ?? '', 'http://localhost').pathname
      .replace(/^\/api\/auth\/?/, '')
      .split('/');
    const { rpID } = getRelyingParty();

    switch (`${req.method} ${route}`) {
      case 'GET me': {
        const authUser = await requireAuth(req, res);
        if (!authUser) return;

        const user = await userRepository.findOneBy({ id: authUser.id });
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        return res.json({ user: toPublicUser(user) });
      }

      case 'POST logout': {
        const authUser = await requireAuth(req, res);
        if (!authUser) return;

        await sessionRepository.delete({ id: authUser.sessionId });
        return res.status(204).end();
      }

      // Signs out every device except the one making the request
      case 'POST sign-out-others': {
        const authUser = await requireAuth(req, res);
        if (!authUser) return;

        await sessionRepository.delete({ userId: authUser.id, id: Not(authUser.sessionId) });
        return res.status(204).end();
      }

      // Step 1 of creating a new account
      case 'POST registration-options': {
        const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
        if (!username) {
          return res.status(400).json({ error: 'Username is required' });
        }

        const userId = uuidv4();
        const options = await generateRegistrationOptions({
          rpName: RP_NAME,
          rpID,
          userName: username,
          userID: uuidParse(userId) as Uint8Array,
          attestationType: 'none',
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        });

        await saveChallenge(options.challenge, ChallengePurpose.REGISTER, {
          userId,
          userName: username,
        });
        return res.json(options);
      }

      // Step 2 of creating a new account
      case 'POST register': {
        const response = req.body?.response as RegistrationResponseJSON | undefined;
        if (!response?.response?.clientDataJSON) {
          return res.status(400).json({ error: 'Missing passkey response' });
        }

        const challenge = await consumeChallenge(
          response.response.clientDataJSON,
          ChallengePurpose.REGISTER
        );
        if (!challenge?.userId || !challenge.userName) {
          return res.status(400).json({ error: 'Invalid or expired challenge' });
        }

        const verification = await verifyRegistration(response, challenge.challenge);
        if (!verification?.registrationInfo) {
          return res.status(400).json({ error: 'Passkey verification failed' });
        }

        const user = userRepository.create({ id: challenge.userId, name: challenge.userName });
        await AppDataSource.transaction(async (manager) => {
          await manager.save(user);
          await manager.save(newCredential(user.id, verification.registrationInfo));
        });

        return res.status(201).json(await authResult(user));
      }

      case 'GET passkeys': {
        const authUser = await requireAuth(req, res);
        if (!authUser) return;

        const credentials = await credentialRepository.find({
          where: { userId: authUser.id },
          order: { createdAt: 'ASC' },
        });
        return res.json(
          credentials.map(({ id, deviceType, backedUp, createdAt, lastUsedAt }) => ({
            id,
            deviceType,
            backedUp,
            createdAt,
            lastUsedAt,
          }))
        );
      }

      case 'DELETE passkeys': {
        const authUser = await requireAuth(req, res);
        if (!authUser) return;
        if (!resourceId) {
          return res.status(400).json({ error: 'Passkey ID is required' });
        }

        // Lock the user's row so two removals at once can't both pass the last-passkey check
        const outcome = await AppDataSource.transaction(async (manager) => {
          await manager
            .getRepository(User)
            .createQueryBuilder('user')
            .setLock('pessimistic_write')
            .where('user.id = :id', { id: authUser.id })
            .getOne();

          const credentials = await manager
            .getRepository(PasskeyCredential)
            .findBy({ userId: authUser.id });
          if (!credentials.some((cred) => cred.id === resourceId)) return 'not_found';
          if (credentials.length === 1) return 'only_passkey';

          await manager
            .getRepository(PasskeyCredential)
            .delete({ id: resourceId, userId: authUser.id });
          return 'deleted';
        });

        if (outcome === 'not_found') {
          return res.status(404).json({ error: 'Passkey not found' });
        }
        if (outcome === 'only_passkey') {
          return res.status(400).json({ error: "Can't remove your only passkey" });
        }
        return res.status(204).end();
      }

      // Step 1 of adding another passkey (e.g. a new device) to the signed-in account
      case 'POST passkey-options': {
        const authUser = await requireAuth(req, res);
        if (!authUser) return;

        const existing = await credentialRepository.findBy({ userId: authUser.id });
        const options = await generateRegistrationOptions({
          rpName: RP_NAME,
          rpID,
          userName: authUser.name,
          userID: uuidParse(authUser.id) as Uint8Array,
          attestationType: 'none',
          excludeCredentials: existing.map((cred) => ({
            id: cred.id,
            transports: cred.transports,
          })),
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        });

        await saveChallenge(options.challenge, ChallengePurpose.ADD_PASSKEY, {
          userId: authUser.id,
        });
        return res.json(options);
      }

      // Step 2 of adding another passkey
      case 'POST passkeys': {
        const authUser = await requireAuth(req, res);
        if (!authUser) return;

        const response = req.body?.response as RegistrationResponseJSON | undefined;
        if (!response?.response?.clientDataJSON) {
          return res.status(400).json({ error: 'Missing passkey response' });
        }

        const challenge = await consumeChallenge(
          response.response.clientDataJSON,
          ChallengePurpose.ADD_PASSKEY
        );
        if (!challenge || challenge.userId !== authUser.id) {
          return res.status(400).json({ error: 'Invalid or expired challenge' });
        }

        const verification = await verifyRegistration(response, challenge.challenge);
        if (!verification?.registrationInfo) {
          return res.status(400).json({ error: 'Passkey verification failed' });
        }

        await credentialRepository.save(newCredential(authUser.id, verification.registrationInfo));
        return res.status(201).json({ success: true });
      }

      // Step 1 of signing in. allowCredentials is empty so the browser offers whichever
      // discoverable passkey the user has for this site, and no credential IDs are exposed.
      case 'POST login-options': {
        const options = await generateAuthenticationOptions({
          rpID,
          userVerification: 'required',
        });
        await saveChallenge(options.challenge, ChallengePurpose.LOGIN);
        return res.json(options);
      }

      // Step 2 of signing in
      case 'POST login': {
        const response = req.body?.response as AuthenticationResponseJSON | undefined;
        if (!response?.id || !response.response?.clientDataJSON) {
          return res.status(400).json({ error: 'Missing passkey response' });
        }

        const challenge = await consumeChallenge(
          response.response.clientDataJSON,
          ChallengePurpose.LOGIN
        );
        if (!challenge) {
          return res.status(400).json({ error: 'Invalid or expired challenge' });
        }

        const credential = await credentialRepository.findOne({
          where: { id: response.id },
          relations: ['user'],
        });
        if (!credential?.user) {
          return res.status(401).json({ error: 'Unknown passkey' });
        }

        const { origin } = getRelyingParty();
        let verification;
        try {
          verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: challenge.challenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: {
              id: credential.id,
              publicKey: isoBase64URL.toBuffer(credential.publicKey),
              counter: credential.counter,
              transports: credential.transports,
            },
          });
        } catch (error) {
          console.error('Passkey authentication verification failed:', error);
          return res.status(401).json({ error: 'Passkey verification failed' });
        }
        if (!verification.verified) {
          return res.status(401).json({ error: 'Passkey verification failed' });
        }

        await credentialRepository.update(credential.id, {
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date(),
        });

        return res.json(await authResult(credential.user));
      }

      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('Error in auth handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
