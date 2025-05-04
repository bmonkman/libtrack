import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibraryCardsService } from './library-cards.service';
import { LibraryCardsController } from './library-cards.controller';
import { LibraryCard } from './entities/library-card.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LibraryCard])],
  controllers: [LibraryCardsController],
  providers: [LibraryCardsService],
})
export class LibraryCardsModule {}
