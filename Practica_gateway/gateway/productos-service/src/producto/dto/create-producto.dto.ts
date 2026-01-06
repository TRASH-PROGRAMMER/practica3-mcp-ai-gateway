import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProductoDto {
  @IsString()
  @IsNotEmpty()
  nombre_generico: string;

  @IsString()
  @IsNotEmpty()
  nombre_comercial: string;

  @IsString()
  @IsNotEmpty()
  principio_activo: string;

  @IsString()
  @IsNotEmpty()
  categoria: string;

  @IsString()
  @IsNotEmpty()
  presentacion: string;

  @IsString()
  @IsNotEmpty()
  concentracion: string;

  @IsBoolean()
  @IsOptional()
  requiere_receta?: boolean = false;
}
