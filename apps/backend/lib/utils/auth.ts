import { VercelRequest, VercelResponse } from '@vercel/node';
import * as jwt from 'jsonwebtoken';

const JWT_EXPIRATION = '72h';

export interface AuthUser {
  id: string;
  name: string;
}

export interface JwtPayload {
  user: AuthUser;
}

// Read at call time rather than module load so a missing secret fails the request loudly instead
// of silently signing tokens with a guessable default.
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
};

export const generateToken = (user: AuthUser): string => {
  return jwt.sign({ user: { id: user.id, name: user.name } }, getJwtSecret(), {
    expiresIn: JWT_EXPIRATION,
  });
};

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch (error) {
    return null;
  }
};

export const getAuthUser = async (req: VercelRequest): Promise<AuthUser | null> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const payload = verifyToken(authHeader.split(' ')[1]);
  return payload?.user ?? null;
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
