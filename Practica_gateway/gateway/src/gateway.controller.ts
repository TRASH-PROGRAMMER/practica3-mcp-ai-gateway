// gateway/src/gateway.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { GatewayService } from './gateway.service';

@Controller()
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  // ---------- RUTAS PARA EL WRITE MODEL (Servicio A) ----------

  // POST /api/productos
  @Post('productos')
  crearProducto(@Body() dto: any) {
    return this.gatewayService.crearProducto(dto);
  }

  // GET /api/productos/write
  @Get('productos/write')
  listarProductosWrite() {
    return this.gatewayService.listarProductosWrite();
  }

  // PATCH /api/productos/:id
  @Patch('productos/:id')
  actualizarProducto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
  ) {
    return this.gatewayService.actualizarProducto(id, dto);
  }

  // DELETE /api/productos/:id
  @Delete('productos/:id')
  eliminarProducto(@Param('id', ParseIntPipe) id: number) {
    return this.gatewayService.eliminarProducto(id);
  }

  // ---------- RUTAS PARA EL READ MODEL (Servicio B) ----------

  // GET /api/catalogo?q=paracetamol
  @Get('catalogo')
  buscarProductos(@Query('q') q = '') {
    return this.gatewayService.buscarProductos(q);
  }

  // GET /api/catalogo/precios?idProducto=1
  @Get('catalogo/precios')
  compararPrecios(
    @Query('idProducto', ParseIntPipe) idProducto: number,
  ) {
    return this.gatewayService.compararPrecios(idProducto);
  }

  // ---------- PRESCRIPCIONES (Nuevo evento de negocio) ----------

  // POST /api/prescripciones
  @Post('prescripciones')
  registrarPrescripcion(@Body() dto: any) {
    return this.gatewayService.registrarPrescripcion(dto);
  }
}
