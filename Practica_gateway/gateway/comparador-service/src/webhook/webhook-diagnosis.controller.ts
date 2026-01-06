import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { FailureDiagnosisService } from './failure-diagnosis.service';

/**
 * Controlador de Diagnóstico de Fallos
 * 
 * Proporciona endpoints para diagnosticar y analizar fallos
 * en sistemas distribuidos
 */
@Controller('webhook/diagnosis')
export class WebhookDiagnosisController {
  constructor(
    private readonly diagnosis: FailureDiagnosisService,
  ) {}

  /**
   * Diagnostica un fallo específico por traceId
   * POST /webhook/diagnosis/:traceId
   */
  @Post(':traceId')
  async diagnoseTrace(@Param('traceId') traceId: string) {
    const diagnosis = await this.diagnosis.diagnoseFailure(traceId);
    
    return {
      status: 'success',
      diagnosis,
    };
  }

  /**
   * Obtiene todos los diagnósticos recientes
   * GET /webhook/diagnosis
   */
  @Get()
  getRecentDiagnoses(@Query('limit') limit?: string) {
    const limitNum = parseInt(limit || '50', 10);
    const diagnoses = this.diagnosis.getRecentDiagnoses(limitNum);

    return {
      timestamp: new Date().toISOString(),
      total: diagnoses.length,
      diagnoses,
    };
  }

  /**
   * Obtiene diagnósticos por severidad
   * GET /webhook/diagnosis/severity/:severity
   */
  @Get('severity/:severity')
  getDiagnosesBySeverity(
    @Param('severity') severity: 'low' | 'medium' | 'high' | 'critical'
  ) {
    const diagnoses = this.diagnosis.getDiagnosesBySeverity(severity);

    return {
      timestamp: new Date().toISOString(),
      severity,
      total: diagnoses.length,
      diagnoses,
    };
  }

  /**
   * Analiza patrones de fallos
   * GET /webhook/diagnosis/patterns
   */
  @Get('patterns/analyze')
  analyzePatterns(@Query('limit') limit?: string) {
    const limitNum = parseInt(limit || '100', 10);
    const analysis = this.diagnosis.analyzeFailurePatterns(limitNum);

    return {
      timestamp: new Date().toISOString(),
      ...analysis,
    };
  }

  /**
   * Obtiene estadísticas de diagnósticos
   * GET /webhook/diagnosis/stats
   */
  @Get('stats')
  getDiagnosisStats() {
    const stats = this.diagnosis.getDiagnosisStats();

    return {
      timestamp: new Date().toISOString(),
      ...stats,
    };
  }
}
