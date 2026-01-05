import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('prescripciones')
export class Prescripcion {
  @PrimaryGeneratedColumn()
  id_prescripcion: number;

  @Column()
  id_paciente: number;

  @Column()
  nombre_paciente: string;

  @Column()
  id_medico: number;

  @Column()
  nombre_medico: string;

  @Column('text')
  diagnostico: string;

  @CreateDateColumn()
  fecha_emision: Date;

  @Column({ default: 'activa' })
  estado: string; // activa, dispensada, vencida
}
