import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductoRead } from '../read_model/producto-read.entity';

@Controller()
export class ProductoEventsController {
  constructor(
    @InjectRepository(ProductoRead)
    private readonly productoReadRepo: Repository<ProductoRead>,
  ) {}

  @EventPattern('producto.creado')
  async onProductoCreado(@Payload() data: any) {
    const { id_producto, ...rest } = data;

    const exists = await this.productoReadRepo.findOne({
      where: { id_producto },
    });
    if (exists) return; // idempotencia básica

    const read = this.productoReadRepo.create({
      id_producto,
      ...rest,
    });

    await this.productoReadRepo.save(read);
  }

  @EventPattern('producto.actualizado')
  async onProductoActualizado(@Payload() data: any) {
    const { id_producto, ...rest } = data;

    let read = await this.productoReadRepo.findOne({
      where: { id_producto },
    });

    if (!read) {
      // si no existe, lo creamos (eventual consistency)
      read = this.productoReadRepo.create([{ id_producto, ...rest }])[0];
    } else {
      Object.assign(read, rest);
    }

    if (read) {
      await this.productoReadRepo.save(read);
    }
  }

  @EventPattern('producto.eliminado')
  async onProductoEliminado(@Payload() data: any) {
    const { id_producto } = data;
    await this.productoReadRepo.delete({ id_producto });
  }
}
