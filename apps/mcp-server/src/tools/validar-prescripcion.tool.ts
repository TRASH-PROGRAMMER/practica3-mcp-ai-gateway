import { BackendClient } from '../services/backend-client';

/**
 * Tool: Validar Prescripción
 * Verifica si una prescripción está activa y puede ser utilizada
 */
export const validarPrescripcionTool = {
  name: 'validar_prescripcion',
  description: 'Valida si una prescripción médica está activa y puede ser dispensada',
  
  inputSchema: {
    type: 'object',
    properties: {
      idPrescripcion: {
        type: 'number',
        description: 'ID de la prescripción a validar',
      },
    },
    required: ['idPrescripcion'],
  },

  async execute(params: { idPrescripcion: number }): Promise<any> {
    const client = new BackendClient();
    
    try {
      const resultado = await client.validarPrescripcion(params.idPrescripcion);
      
      return {
        success: resultado.valida,
        message: resultado.mensaje,
        data: {
          idPrescripcion: params.idPrescripcion,
          valida: resultado.valida,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        data: {
          idPrescripcion: params.idPrescripcion,
          valida: false,
        },
      };
    }
  },
};
