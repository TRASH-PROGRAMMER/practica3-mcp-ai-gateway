import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProductoDto {
  @IsString()
  @IsNotEmpty()
  nombre_generico: string;

  @IsString()
  @IsNotEmpty()
  nombre_comercial: string;

  @IsString()
  @IsOptional()
  principio_activo?: string;

  @IsString()
  @IsOptional()
  categoria?: string;

  @IsString()
  @IsOptional()
  presentacion?: string;

  @IsString()
  @IsOptional()
  concentracion?: string;

  @IsBoolean()
  @IsOptional()
  requiere_receta?: boolean;
}
