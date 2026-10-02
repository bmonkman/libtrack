import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { Book } from './entities/Book';
import { LibraryCard } from './entities/LibraryCard';
import { PasskeyCredential } from './entities/PasskeyCredential';
import { User } from './entities/User';
import { WebAuthnChallenge } from './entities/WebAuthnChallenge';

dotenv.config();

// TLS settings come from the URL (Neon URLs carry sslmode=require).
// Schema changes go through migrations only (npm run migration:run). synchronize is off
// everywhere because local dev has pointed at the production database.
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Book, LibraryCard, PasskeyCredential, User, WebAuthnChallenge],
  migrations: ['migrations/**/*.ts'],
  synchronize: false,
});
