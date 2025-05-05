import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    console.log('Starting application...');
    console.log('PORT:', process.env.PORT);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

    const app = await NestFactory.create(AppModule);
    app.enableCors();
    const port = process.env.PORT ?? 3000;

    // Log startup information
    console.log('Application configured with CORS enabled');
    console.log(`Listening on port ${port}`);

    await app.listen(port);
    console.log(`Application is running on port ${port}`);
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

void bootstrap();
