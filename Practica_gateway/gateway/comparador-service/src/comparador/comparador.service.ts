import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { ProductoRead } from '../read_model/producto-read.entity';
import { DetallePrescripcion } from '../read_model/detalle-prescripcion.entity';
import { Comparacion } from '../comparacion/comparacion.entity';

@Injectable()
export class ComparadorService {
  constructor(
    @InjectRepository(ProductoRead)
    private readonly productoReadRepo: Repository<ProductoRead>,

    @InjectRepository(DetallePrescripcion)
    private readonly detalleRepo: Repository<DetallePrescripcion>,

    @InjectRepository(Comparacion)
    private readonly comparacionRepo: Repository<Comparacion>,

    @Inject('EVENT_BUS') private readonly eventBus: ClientProxy,
  ) {}

  // Query 1: buscar productos por nombre (CQRS read)
  async buscarProductos(term: string) {
    return this.productoReadRepo.find({
      where: [
        { nombre_generico: term ? Like(`%${term}%`) : undefined },
        { nombre_comercial: term ? Like(`%${term}%`) : undefined },
      ],
      take: 20,
    });
  }

  // Query 2: ver precios (detalle_prescripcion) para un producto
  async compararPrecios(idProducto: number, idUsuario?: number) {
    const producto = await this.productoReadRepo.findOne({
      where: { id_producto: idProducto },
    });

    if (!producto) {
      return { error: 'Producto no encontrado' };
    }

    // Simular comparación con farmacias (precio base ficticio de 100)
    const precioBase = 100; // Precio simulado ya que ProductoRead no tiene precio
    const comparaciones = [
      {
        farmacia: 'Farmacia Central',
        precio: precioBase * 0.95,
        stock_disponible: true,
        descuento: 5,
      },
      {
        farmacia: 'Farmacia del Ahorro',
        precio: precioBase * 1.05,
        stock_disponible: true,
        descuento: 0,
      },
      {
        farmacia: 'Farmacia San Pablo',
        precio: precioBase,
        stock_disponible: false,
        descuento: 0,
      },
    ];

    // Calcular métricas
    const precios = comparaciones.map((c) => c.precio);
    const precio_min = Math.min(...precios);
    const precio_max = Math.max(...precios);
    const ahorro_potencial = precio_max - precio_min;

    // 1. Guardar comparación en BD
    const comparacion = this.comparacionRepo.create({
      id_producto: idProducto,
      nombre_producto: producto.nombre_comercial,
      id_usuario: idUsuario,
      resultado: comparaciones,
      precio_min,
      precio_max,
      ahorro_potencial,
    });

    const comparacionGuardada = await this.comparacionRepo.save(comparacion);

    // 2. 🔥 EMITIR EVENTO DE NEGOCIO
    const evento = {
      event_type: 'comparacion.realizada',
      event_id: `comparacion-${comparacionGuardada.id_comparacion}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: {
        id_comparacion: comparacionGuardada.id_comparacion,
        id_producto: idProducto,
        nombre_producto: producto.nombre_comercial,
        id_usuario: idUsuario,
        precio_min,
        precio_max,
        ahorro_potencial,
        total_farmacias: comparaciones.length,
        fecha_comparacion: comparacionGuardada.fecha_comparacion,
      },
    };

    // Emitir a RabbitMQ
    this.eventBus.emit('comparacion.realizada', evento.data);

    console.log('✅ Evento emitido: comparacion.realizada', evento.event_id);

    return {
      producto: producto.nombre_comercial,
      comparaciones,
      ahorro_potencial: `$${ahorro_potencial.toFixed(2)}`,
      mejor_precio: comparaciones.find((c) => c.precio === precio_min)?.farmacia,
      evento_emitido: evento.event_id,
    };
  }
}
