import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { databaseConfig } from './config/database.config';
import { BooksModule } from './books/books.module';
import { LibraryCardsModule } from './library-cards/library-cards.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig()),
    BooksModule,
    LibraryCardsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
