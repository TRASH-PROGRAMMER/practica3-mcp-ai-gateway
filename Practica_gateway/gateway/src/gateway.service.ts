// gateway/src/gateway.service.ts
import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class GatewayService {
  constructor(
    @Inject('PRODUCTOS_SERVICE') private readonly productosClient: ClientProxy,
    @Inject('COMPARADOR_SERVICE') private readonly comparadorClient: ClientProxy,
  ) {}

  // ---------- COMANDOS (Write model: Servicio A) ----------

  async crearProducto(dto: any) {
    try {
      return await firstValueFrom(
        this.productosClient.send({ cmd: 'crear_producto' }, dto).pipe(timeout(5000))
      );
    } catch (err) {
      throw new HttpException(
        'Servicio de productos no disponible',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async listarProductosWrite() {
    try {
      return await firstValueFrom(
        this.productosClient.send({ cmd: 'listar_productos' }, {}).pipe(timeout(5000))
      );
    } catch (err) {
      throw new HttpException(
        'Servicio de productos no disponible',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async actualizarProducto(id: number, dto: any) {
    try {
      return await firstValueFrom(
        this.productosClient.send({ cmd: 'actualizar_producto' }, { id, ...dto }).pipe(timeout(5000))
      );
    } catch (err) {
      throw new HttpException(
        'No se pudo actualizar el producto',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async eliminarProducto(id: number) {
    try {
      await firstValueFrom(
        this.productosClient.send({ cmd: 'eliminar_producto' }, { id }).pipe(timeout(5000))
      );
      return { message: 'Producto eliminado (write model)' };
    } catch (err) {
      throw new HttpException(
        'No se pudo eliminar el producto',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ---------- QUERIES (Read model: Servicio B) ----------

  async buscarProductos(term: string) {
    try {
      return await firstValueFrom(
        this.comparadorClient.send({ cmd: 'buscar_productos' }, { q: term }).pipe(timeout(5000))
      );
    } catch (err) {
      throw new HttpException(
        'Servicio de comparador no disponible. Intenta más tarde.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async compararPrecios(idProducto: number) {
    try {
      return await firstValueFrom(
        this.comparadorClient.send({ cmd: 'comparar_precios' }, { idProducto }).pipe(timeout(5000))
      );
    } catch (err) {
      throw new HttpException(
        'No se pudo obtener la comparación de precios',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ---------- PRESCRIPCIONES (Nuevo evento de negocio) ----------

  async registrarPrescripcion(dto: any) {
    try {
      return await firstValueFrom(
        this.comparadorClient.send({ cmd: 'registrar_prescripcion' }, dto).pipe(timeout(5000))
      );
    } catch (err) {
      throw new HttpException(
        'No se pudo registrar la prescripción',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
