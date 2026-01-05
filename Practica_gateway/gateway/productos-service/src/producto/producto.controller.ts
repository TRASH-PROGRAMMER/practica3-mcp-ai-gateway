import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductoService } from './dto/producto.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

@Controller()
export class ProductoController {
  constructor(private readonly productoService: ProductoService) {}

  @MessagePattern('crear_producto')
  create(@Payload() dto: CreateProductoDto) {
    return this.productoService.create(dto);
  }

  @MessagePattern('listar_productos')
  findAll() {
    return this.productoService.findAll();
  }

  @MessagePattern('obtener_producto')
  findOne(@Payload() id: number) {
    return this.productoService.findOne(id);
  }

  @MessagePattern('actualizar_producto')
  update(@Payload() data: { id: number; dto: UpdateProductoDto }) {
    return this.productoService.update(data.id, data.dto);
  }

  @MessagePattern('eliminar_producto')
  remove(@Payload() id: number) {
    return this.productoService.remove(id);
  }
}
