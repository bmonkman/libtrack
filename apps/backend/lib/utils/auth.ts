import { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, randomBytes } from 'node:crypto';
import { LessThan } from 'typeorm';
import { AppDataSource } from '../ormconfig';
import { Session } from '../entities/Session';

const DAY_MS = 24 * 60 * 60 * 1000;

// A session ends after this long without being used. Each use pushes the end date out again.
export const SESSION_IDLE_LIMIT_MS = 90 * DAY_MS;

// Pushing the end date out is a database write, so do it at most this often per session
const SESSION_EXTEND_EVERY_MS = 60 * 60 * 1000;

export interface AuthUser {
  id: string;
  name: string;
  sessionId: string;
}

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const sessionNeedsExtending = (lastUsedAt: Date, now: Date): boolean =>
  now.getTime() - lastUsedAt.getTime() >= SESSION_EXTEND_EVERY_MS;

// Starts a session and returns the token the browser sends as `Authorization: Bearer`
export const createSession = async (userId: string): Promise<string> => {
  const repository = AppDataSource.getRepository(Session);
  const now = new Date();
  await repository.delete({ expiresAt: LessThan(now) });

  const token = randomBytes(32).toString('base64url');
  await repository.insert({
    tokenHash: hashToken(token),
    userId,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + SESSION_IDLE_LIMIT_MS),
  });
  return token;
};

const getAuthUser = async (req: VercelRequest): Promise<AuthUser | null> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const repository = AppDataSource.getRepository(Session);
  const session = await repository.findOne({
    where: { tokenHash: hashToken(authHeader.slice('Bearer '.length)) },
    relations: ['user'],
  });
  const now = new Date();
  if (!session?.user || session.expiresAt <= now) {
    return null;
  }

  if (sessionNeedsExtending(session.lastUsedAt, now)) {
    await repository.update(session.id, {
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + SESSION_IDLE_LIMIT_MS),
    });
  }
  return { id: session.user.id, name: session.user.name, sessionId: session.id };
};

export const requireAuth = async (
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthUser | null> => {
  const user = await getAuthUser(req);

  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  return user;
};
