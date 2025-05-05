import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  entities: ['api/entities/**/*.ts'],
  migrations: ['migrations/**/*.ts'],
  synchronize: process.env.NODE_ENV === 'development',
});
