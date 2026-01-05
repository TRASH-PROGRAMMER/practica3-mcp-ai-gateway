import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('producto')
export class Producto {
  @PrimaryGeneratedColumn()
  id_producto: number;

  @Column({ length: 150 })
  nombre_generico: string;

  @Column({ length: 150 })
  nombre_comercial: string;

  @Column({ length: 150 })
  principio_activo: string;

  @Column({ length: 100 })
  categoria: string;

  @Column({ length: 100 })
  presentacion: string;

  @Column({ length: 50 })
  concentracion: string;

  @Column({ default: false })
  requiere_receta: boolean;
}
