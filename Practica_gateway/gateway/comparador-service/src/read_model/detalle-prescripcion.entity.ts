import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProductoRead } from './producto-read.entity';

@Entity('detalle_prescripcion')
export class DetallePrescripcion {
  @PrimaryGeneratedColumn()
  id_detalle_prescripcion: number;

  @Column()
  id_detalle_receta: number;   // FK lógica hacia otra tabla

  @Column()
  id_farmacia: number;

  @Column()
  id_producto: number;

  @ManyToOne(() => ProductoRead, (p) => p.detalles)
  @JoinColumn({ name: 'id_producto' })
  producto: ProductoRead;

  @Column('decimal', { precision: 10, scale: 2 })
  precio_encontrado: number;

  @Column('float', { nullable: true })
  distancia: number;

  @Column({ type: 'datetime' })
  fecha_consulta: Date;

  @Column({ length: 100 })
  fuente: string;
}
