import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { DetallePrescripcion } from './detalle-prescripcion.entity';

@Entity('producto_read')
export class ProductoRead {
  @PrimaryColumn()
  id_producto: number;           // viene del microservicio A

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

  // Relación con la entidad transaccional
  @OneToMany(() => DetallePrescripcion, (d) => d.producto)
  detalles: DetallePrescripcion[];
}
