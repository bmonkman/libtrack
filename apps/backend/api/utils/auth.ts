import { VercelRequest, VercelResponse } from '@vercel/node';
import { AppDataSource } from '../ormconfig';
import { User } from '../entities/User';
import { PasskeyCredential } from '../entities/PasskeyCredential';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRATION = '72h';

export interface AuthUser {
  id: string;
  name: string;
}

export interface JwtPayload {
  user: AuthUser;
}

export const generateToken = (user: AuthUser): string => {
  return jwt.sign({ user }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
};

export const getAuthUser = async (req: VercelRequest): Promise<AuthUser | null> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (!payload || !payload.user) {
      return null;
    }

    return payload.user;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
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

export const findUserByCredential = async (credentialId: string): Promise<User | null> => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const credentialRepository = AppDataSource.getRepository(PasskeyCredential);
  const credential = await credentialRepository.findOne({
    where: { id: credentialId },
    relations: ['user'],
  });

  return credential?.user || null;
};

export const registerPasskey = async (
  userId: string,
  credentialId: string,
  publicKey: string,
  algorithm: string,
  authenticatorAttachment: string,
  transports: string[]
): Promise<PasskeyCredential> => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const userRepository = AppDataSource.getRepository(User);
  const credentialRepository = AppDataSource.getRepository(PasskeyCredential);

  const user = await userRepository.findOneBy({ id: userId });
  if (!user) {
    throw new Error('User not found');
  }

  const credential = new PasskeyCredential(
    credentialId,
    publicKey,
    algorithm,
    authenticatorAttachment as any,
    transports as any,
    user
  );

  return credentialRepository.save(credential);
};
