import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Prescripcion } from './prescripcion.entity';
import { DetallePrescripcion } from '../read_model/detalle-prescripcion.entity';
import { RegistrarPrescripcionDto } from './dto/registrar-prescripcion.dto';

@Injectable()
export class PrescripcionService {
  constructor(
    @InjectRepository(Prescripcion)
    private readonly prescripcionRepo: Repository<Prescripcion>,
    @InjectRepository(DetallePrescripcion)
    private readonly detalleRepo: Repository<DetallePrescripcion>,
    @Inject('EVENT_BUS') private readonly eventBus: ClientProxy,
  ) {}

  /**
   * Registra una nueva prescripción y emite evento de negocio
   */
  async registrarPrescripcion(dto: RegistrarPrescripcionDto) {
    // 1. Crear prescripción
    const prescripcion = this.prescripcionRepo.create({
      id_paciente: dto.id_paciente,
      nombre_paciente: dto.nombre_paciente,
      id_medico: dto.id_medico,
      nombre_medico: dto.nombre_medico,
      diagnostico: dto.diagnostico,
    });

    const prescripcionGuardada = await this.prescripcionRepo.save(prescripcion);

    // 2. Crear detalles de medicamentos
    const detalles = dto.medicamentos.map((med) =>
      this.detalleRepo.create({
        id_detalle_receta: prescripcionGuardada.id_prescripcion,
        id_farmacia: 1, // Farmacia por defecto
        id_producto: med.id_producto,
        precio_encontrado: 0, // Se actualizará después
        distancia: 0,
        fecha_consulta: new Date(),
        fuente: 'prescripcion',
      }),
    );

    await this.detalleRepo.save(detalles);

    // 3. 🔥 EMITIR EVENTO DE NEGOCIO
    const evento = {
      event_type: 'prescripcion.registrada',
      event_id: `prescripcion-${prescripcionGuardada.id_prescripcion}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: {
        id_prescripcion: prescripcionGuardada.id_prescripcion,
        id_paciente: dto.id_paciente,
        nombre_paciente: dto.nombre_paciente,
        id_medico: dto.id_medico,
        nombre_medico: dto.nombre_medico,
        diagnostico: dto.diagnostico,
        medicamentos: dto.medicamentos,
        fecha_emision: prescripcionGuardada.fecha_emision,
      },
    };

    // Emitir a RabbitMQ
    this.eventBus.emit('prescripcion.registrada', evento.data);

    console.log('✅ Evento emitido: prescripcion.registrada', evento.event_id);

    return {
      prescripcion: prescripcionGuardada,
      detalles,
      evento_emitido: evento.event_id,
    };
  }
}
