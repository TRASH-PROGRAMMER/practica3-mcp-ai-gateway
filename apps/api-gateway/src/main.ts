import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors();

  // Puerto
  const port = process.env.PORT || 3000;

  await app.listen(port);

  logger.log(`🚀 API Gateway iniciado en http://localhost:${port}`);
  logger.log(`📚 Endpoints disponibles:`);
  logger.log(`   POST http://localhost:${port}/ia/query - Consultar con IA`);
  logger.log(`   GET  http://localhost:${port}/ia/tools - Listar tools`);
  logger.log(`   GET  http://localhost:${port}/ia/health - Health check`);
}

bootstrap();
