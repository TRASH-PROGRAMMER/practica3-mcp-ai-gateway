// gateway/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api'); // todo pasa por /api/...

  await app.listen(3000);
  console.log('API Gateway escuchando en http://localhost:3000/api');
}
bootstrap();
