export class RegistrarPrescripcionDto {
  id_paciente: number;
  nombre_paciente: string;
  id_medico: number;
  nombre_medico: string;
  diagnostico: string;
  medicamentos: Array<{
    id_producto: number;
    nombre_comercial: string;
    dosis: string;
    frecuencia: string;
    duracion_dias: number;
  }>;
}
