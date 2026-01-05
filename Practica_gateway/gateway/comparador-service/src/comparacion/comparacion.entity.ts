import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('comparaciones')
export class Comparacion {
  @PrimaryGeneratedColumn()
  id_comparacion: number;

  @Column()
  id_producto: number;

  @Column()
  nombre_producto: string;

  @Column({ nullable: true })
  id_usuario: number;

  @Column('simple-json')
  resultado: {
    farmacia: string;
    precio: number;
    stock_disponible: boolean;
    descuento?: number;
  }[];

  @Column('decimal', { precision: 10, scale: 2 })
  precio_min: number;

  @Column('decimal', { precision: 10, scale: 2 })
  precio_max: number;

  @Column('decimal', { precision: 10, scale: 2 })
  ahorro_potencial: number;

  @CreateDateColumn()
  fecha_comparacion: Date;
}
