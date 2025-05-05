import { DataSource, DataSourceOptions } from 'typeorm';
import { Book } from '../books/entities/book.entity';
import { LibraryCard } from '../library-cards/entities/library-card.entity';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const isMigrationCommand = process.argv.some((arg) =>
  arg.includes('migration'),
);

export const databaseConfig = (): DataSourceOptions => ({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  entities: [Book, LibraryCard],
  migrations: isMigrationCommand ? ['src/migrations/*.ts'] : [],
  migrationsTableName: 'migrations',
  synchronize: process.env.NODE_ENV !== 'production',
});

// This is used by TypeORM CLI for migrations
export const AppDataSource = new DataSource(databaseConfig());
