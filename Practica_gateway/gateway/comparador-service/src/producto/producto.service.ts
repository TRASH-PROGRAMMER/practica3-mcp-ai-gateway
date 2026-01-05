import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Producto } from './producto.entity';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

@Injectable()
export class ProductoService {
  constructor(
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,

    @Inject('PRODUCTO_EVENTS')
    private readonly eventsClient: ClientProxy,
  ) {}

  async create(dto: CreateProductoDto): Promise<Producto> {
    const producto = this.productoRepo.create(dto);
    const saved = await this.productoRepo.save(producto);

    // 📢 Evento de dominio -> RabbitMQ
    this.eventsClient.emit('producto.creado', {
      id_producto: saved.id_producto,
      nombre_generico: saved.nombre_generico,
      nombre_comercial: saved.nombre_comercial,
      principio_activo: saved.principio_activo,
      categoria: saved.categoria,
      presentacion: saved.presentacion,
      concentracion: saved.concentracion,
      requiere_receta: saved.requiere_receta,
    });

    return saved;
  }

  async findOne(id: number): Promise<Producto> {
    const prod = await this.productoRepo.findOne({ where: { id_producto: id } });
    if (!prod) throw new NotFoundException('Producto no encontrado');
    return prod;
  }

  async update(id: number, dto: UpdateProductoDto): Promise<Producto> {
    const prod = await this.findOne(id);
    Object.assign(prod, dto);
    const updated = await this.productoRepo.save(prod);

    // 📢 Evento de dominio -> RabbitMQ
    this.eventsClient.emit('producto.actualizado', {
      id_producto: updated.id_producto,
      nombre_generico: updated.nombre_generico,
      nombre_comercial: updated.nombre_comercial,
      principio_activo: updated.principio_activo,
      categoria: updated.categoria,
      presentacion: updated.presentacion,
      concentracion: updated.concentracion,
      requiere_receta: updated.requiere_receta,
    });

    return updated;
  }

  async remove(id: number): Promise<void> {
    const prod = await this.findOne(id);
    await this.productoRepo.remove(prod);

    // Opcional: evento de borrado
    this.eventsClient.emit('producto.eliminado', {
      id_producto: id,
    });
  }

  findAll(): Promise<Producto[]> {
    return this.productoRepo.find();
  }
}
