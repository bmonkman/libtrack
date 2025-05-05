import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { Book } from './entities/Book';
import { LibraryCard } from './entities/LibraryCard';
import { PasskeyCredential } from './entities/PasskeyCredential';
import { User } from './entities/User';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  entities: [Book, LibraryCard, PasskeyCredential, User],
  migrations: ['migrations/**/*.ts'],
  synchronize: process.env.NODE_ENV === 'development',
});
