import { VercelRequest, VercelResponse } from '@vercel/node';
import { AppDataSource } from './ormconfig';
import { User } from './entities/User';
import {
  PasskeyCredential,
  AuthenticatorAttachment,
  Transport,
} from './entities/PasskeyCredential';
import { generateToken, findUserByCredential, verifyToken } from './utils/auth';
import { handleCors } from './utils/utils';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const userRepository = AppDataSource.getRepository(User);
const credentialRepository = AppDataSource.getRepository(PasskeyCredential);

// Store challenges for verification (in a real app, this would use a database or Redis)
const challengeStore: Map<string, { challenge: string; userId?: string; expires: number }> =
  new Map();

// Helper to generate a random challenge
function generateChallenge(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Helper to store a challenge with expiration
function storeChallenge(challenge: string, userId?: string): void {
  // Expire after 5 minutes
  challengeStore.set(challenge, {
    challenge,
    userId,
    expires: Date.now() + 5 * 60 * 1000,
  });
}

// Helper to verify a challenge is valid and hasn't expired
function verifyChallenge(challenge: string): boolean {
  const storedChallenge = challengeStore.get(challenge);
  if (!storedChallenge) return false;

  // Check if challenge has expired
  if (storedChallenge.expires < Date.now()) {
    challengeStore.delete(challenge);
    return false;
  }

  return true;
}

// Function to convert ArrayBuffer to Base64 URL string
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64url');
}

// Function to convert Base64 URL string to ArrayBuffer
function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  return Buffer.from(base64Url, 'base64url');
}

// Function to convert a UUID to a URL safe base64 string suitable for WebAuthn user.id
function uuidToBase64Url(uuid: string): string {
  // Remove dashes and convert to Buffer
  const hexString = uuid.replace(/-/g, '');
  const buffer = Buffer.from(hexString, 'hex');
  return buffer.toString('base64url');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    // Extract path for both POST and GET methods
    const path = req.url?.split('/').pop()?.toLowerCase();

    switch (req.method) {
      case 'GET': {
        // Handle GET requests
        switch (path) {
          case 'me': {
            // Get current authenticated user
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
              return res.status(401).json({ error: 'Authentication required' });
            }

            const token = authHeader.split(' ')[1];
            const decoded = verifyToken(token);

            if (!decoded || !decoded.user || !decoded.user.id) {
              return res.status(401).json({ error: 'Invalid token' });
            }

            const userId = decoded.user.id;
            const user = await userRepository.findOne({
              where: { id: userId },
              relations: ['credentials', 'libraryCards', 'books'],
            });

            if (!user) {
              return res.status(404).json({ error: 'User not found' });
            }

            return res.json({ user });
          }

          default:
            return res.status(404).json({ error: 'Endpoint not found' });
        }
      }

      case 'POST': {
        // Handle different auth operations based on the path

        switch (path) {
          case 'registration-options': {
            // Generate registration options
            const { username } = req.body;

            if (!username) {
              return res.status(400).json({ error: 'Username is required' });
            }

            // Generate a random challenge
            const challenge = generateChallenge();
            storeChallenge(challenge);

            // Generate a random user ID for new user
            const userId = uuidv4();
            // Convert userId to base64url for WebAuthn
            const userIdBase64 = uuidToBase64Url(userId);
            // Store the original UUID in the challenge store for later retrieval
            storeChallenge(challenge, userId);

            // Create registration options based on WebAuthn specs
            const options = {
              challenge,
              rp: {
                name: 'LibTrack',
                // Use a fixed domain name that matches your frontend domain
                id: process.env.WEBAUTHN_RP_ID || req.headers.host || 'localhost',
              },
              user: {
                id: userIdBase64, // Send base64url encoded ID that frontend can convert to ArrayBuffer
                name: username,
                displayName: username,
              },
              pubKeyCredParams: [
                { type: 'public-key', alg: -7 }, // ES256
                { type: 'public-key', alg: -257 }, // RS256
              ],
              timeout: 60000,
              attestation: 'none',
              authenticatorSelection: {
                authenticatorAttachment: 'platform',
                requireResidentKey: false,
                userVerification: 'preferred',
              },
            };

            return res.status(200).json(options);
          }

          case 'login-options': {
            // Generate login options

            // Generate a random challenge
            const challenge = generateChallenge();
            storeChallenge(challenge);

            // Get all registered credentials to allow for login
            const credentials = await credentialRepository.find();

            // Create login options based on WebAuthn specs
            const options = {
              challenge,
              timeout: 60000,
              rpId: process.env.WEBAUTHN_RP_ID || req.headers.host || 'localhost',
              allowCredentials: credentials.map((cred) => ({
                id: cred.id,
                type: 'public-key',
                transports: cred.transports,
              })),
              userVerification: 'preferred',
            };

            return res.status(200).json(options);
          }

          case 'register': {
            // Register a new user with passkey
            const { name, credential } = req.body;

            if (!name || !credential) {
              return res.status(400).json({ error: 'Missing required registration parameters' });
            }

            try {
              const { id, rawId, response, type } = credential;

              if (type !== 'public-key') {
                return res.status(400).json({ error: 'Invalid credential type' });
              }

              // Decode the client data
              const clientDataJSON = JSON.parse(
                Buffer.from(response.clientDataJSON, 'base64').toString()
              );

              // Verify challenge is valid
              if (!verifyChallenge(clientDataJSON.challenge)) {
                return res.status(400).json({ error: 'Invalid or expired challenge' });
              }

              // In a real implementation, you would verify the attestation here
              // For now, we'll just extract the public key
              const publicKey = id; // Simplified - in real implementation, parse from attestationObject
              const algorithm = 'ES256'; // Simplified

              // Create new user
              const user = new User(name);
              const savedUser = await userRepository.save(user);

              // Create passkey credential
              const passkeyCredential = new PasskeyCredential(
                id,
                publicKey,
                algorithm,
                AuthenticatorAttachment.PLATFORM, // Simplified
                [Transport.INTERNAL], // Simplified
                savedUser
              );

              await credentialRepository.save(passkeyCredential);

              // Generate JWT token
              const token = generateToken({
                id: savedUser.id,
                name: savedUser.name,
              });

              return res.status(201).json({ user: savedUser, token });
            } catch (error) {
              console.error('Registration error:', error);
              return res.status(400).json({ error: 'Invalid credential data' });
            }
          }

          case 'login': {
            // Authenticate user with passkey
            const { credential } = req.body;

            if (!credential) {
              return res.status(400).json({ error: 'Missing credential' });
            }

            try {
              const { id, rawId, response } = credential;

              // Decode the client data
              const clientDataJSON = JSON.parse(
                Buffer.from(response.clientDataJSON, 'base64').toString()
              );

              // Verify challenge is valid
              if (!verifyChallenge(clientDataJSON.challenge)) {
                return res.status(400).json({ error: 'Invalid or expired challenge' });
              }

              // Find the user by credential ID
              const user = await findUserByCredential(id);

              if (!user) {
                return res.status(401).json({ error: 'Invalid credential' });
              }

              // In a real implementation, you would verify the signature here
              // For now, we'll just check if the credential ID exists

              // Generate JWT token
              const token = generateToken({
                id: user.id,
                name: user.name,
              });

              return res.json({ user, token });
            } catch (error) {
              console.error('Login error:', error);
              return res.status(400).json({ error: 'Invalid credential data' });
            }
          }

          case 'verify': {
            // Legacy verification endpoint
            const { credentialId } = req.body;

            if (!credentialId) {
              return res.status(400).json({ error: 'Missing credential ID' });
            }

            const user = await findUserByCredential(credentialId);

            if (!user) {
              return res.status(401).json({ error: 'Invalid credential' });
            }

            // Generate JWT token
            const token = generateToken({
              id: user.id,
              name: user.name,
            });

            return res.json({ user, token });
          }

          case 'me': {
            // Get current authenticated user
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
              return res.status(401).json({ error: 'Authentication required' });
            }

            const token = authHeader.split(' ')[1];
            const decoded = verifyToken(token);

            if (!decoded || !decoded.user || !decoded.user.id) {
              return res.status(401).json({ error: 'Invalid token' });
            }

            const userId = decoded.user.id;
            const user = await userRepository.findOne({
              where: { id: userId },
              relations: ['credentials', 'libraryCards', 'books'],
            });

            if (!user) {
              return res.status(404).json({ error: 'User not found' });
            }

            return res.json({ user });
          }

          default:
            return res.status(404).json({ error: 'Endpoint not found' });
        }
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in auth handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
