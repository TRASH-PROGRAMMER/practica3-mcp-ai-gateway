import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from './producto/producto.entity';
import { ProductoModule } from './producto/producto.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'catalogo.db',
      entities: [Producto],
      synchronize: true, // solo para desarrollo
    }),
    ProductoModule,
  ],
})
export class AppModule {}
