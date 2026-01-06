import { Injectable, Logger } from '@nestjs/common';

/**
 * Estados del Circuit Breaker
 */
enum CircuitState {
  CLOSED = 'CLOSED',       // Funcionamiento normal
  OPEN = 'OPEN',          // Circuito abierto, rechazando peticiones
  HALF_OPEN = 'HALF_OPEN' // Probando si el servicio se recuperó
}

/**
 * Configuración del Circuit Breaker
 */
interface CircuitBreakerConfig {
  failureThreshold: number;     // Fallos consecutivos para abrir circuito
  successThreshold: number;     // Éxitos para cerrar circuito desde half-open
  timeout: number;              // Tiempo en ms antes de intentar half-open
  resetTimeout: number;         // Tiempo para reiniciar contador de fallos
}

/**
 * Métricas de un circuito
 */
export interface CircuitMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastStateChange: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * Circuit Breaker Service
 * 
 * Implementa el patrón Circuit Breaker para proteger endpoints externos:
 * - CLOSED: Peticiones normales, cuenta fallos
 * - OPEN: Rechaza peticiones rápidamente sin llamar al servicio
 * - HALF_OPEN: Permite peticiones de prueba para verificar recuperación
 * 
 * Previene sobrecarga de servicios externos que están fallando
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  // Configuración por defecto
  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,      // 5 fallos consecutivos
    successThreshold: 2,      // 2 éxitos para cerrar
    timeout: 60000,           // 60s antes de half-open
    resetTimeout: 300000,     // 5min para resetear contador
  };

  // Circuitos por endpoint
  private readonly circuits = new Map<string, CircuitMetrics>();

  /**
   * Ejecuta una función protegida por circuit breaker
   * 
   * @param circuitName - Nombre único del circuito (ej: 'external-api')
   * @param fn - Función async a ejecutar
   * @param config - Configuración opcional
   * @returns Resultado de la función o error si circuito está abierto
   */
  async execute<T>(
    circuitName: string,
    fn: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const circuitConfig = { ...this.defaultConfig, ...config };
    const metrics = this.getOrCreateCircuit(circuitName);

    // 1. Verificar estado del circuito
    const state = this.getState(circuitName, circuitConfig);

    if (state === CircuitState.OPEN) {
      this.logger.warn(
        `🚫 Circuit OPEN para ${circuitName}. Rechazando petición.`
      );
      throw new Error(
        `Circuit breaker is OPEN for ${circuitName}. Service temporarily unavailable.`
      );
    }

    // 2. Ejecutar función
    metrics.totalRequests++;

    try {
      const result = await fn();

      // 3. Registrar éxito
      this.recordSuccess(circuitName);
      
      return result;

    } catch (error) {
      // 4. Registrar fallo
      this.recordFailure(circuitName);
      
      throw error;
    }
  }

  /**
   * Obtiene el estado actual del circuito
   */
  private getState(
    circuitName: string,
    config: CircuitBreakerConfig
  ): CircuitState {
    const metrics = this.circuits.get(circuitName);
    if (!metrics) return CircuitState.CLOSED;

    const now = Date.now();

    // Si está OPEN, verificar si es tiempo de pasar a HALF_OPEN
    if (metrics.state === CircuitState.OPEN) {
      const timeSinceOpen = now - metrics.lastStateChange;
      
      if (timeSinceOpen >= config.timeout) {
        this.changeState(circuitName, CircuitState.HALF_OPEN);
        this.logger.log(
          `🔄 Circuit ${circuitName} pasó a HALF_OPEN (probando recuperación)`
        );
        return CircuitState.HALF_OPEN;
      }
      
      return CircuitState.OPEN;
    }

    // Si está HALF_OPEN, mantener ese estado
    if (metrics.state === CircuitState.HALF_OPEN) {
      return CircuitState.HALF_OPEN;
    }

    // Si está CLOSED, verificar si debe abrirse
    if (metrics.failures >= config.failureThreshold) {
      this.changeState(circuitName, CircuitState.OPEN);
      this.logger.error(
        `🔴 Circuit ${circuitName} ABIERTO. ` +
        `Fallos: ${metrics.failures}/${config.failureThreshold}`
      );
      return CircuitState.OPEN;
    }

    // Resetear contador de fallos si pasó mucho tiempo
    if (metrics.lastFailureTime) {
      const timeSinceFailure = now - metrics.lastFailureTime;
      if (timeSinceFailure >= config.resetTimeout) {
        metrics.failures = 0;
        this.logger.debug(
          `♻️  Contador de fallos reseteado para ${circuitName}`
        );
      }
    }

    return CircuitState.CLOSED;
  }

  /**
   * Registra un éxito en el circuito
   */
  private recordSuccess(circuitName: string): void {
    const metrics = this.circuits.get(circuitName);
    if (!metrics) return;

    metrics.successes++;
    metrics.totalSuccesses++;

    // Si está en HALF_OPEN, verificar si cerrar el circuito
    if (metrics.state === CircuitState.HALF_OPEN) {
      if (metrics.successes >= this.defaultConfig.successThreshold) {
        this.changeState(circuitName, CircuitState.CLOSED);
        metrics.failures = 0;
        metrics.successes = 0;
        this.logger.log(
          `✅ Circuit ${circuitName} CERRADO (servicio recuperado)`
        );
      }
    } else if (metrics.state === CircuitState.CLOSED) {
      // En CLOSED, resetear fallos tras un éxito
      metrics.failures = 0;
    }
  }

  /**
   * Registra un fallo en el circuito
   */
  private recordFailure(circuitName: string): void {
    const metrics = this.circuits.get(circuitName);
    if (!metrics) return;

    metrics.failures++;
    metrics.totalFailures++;
    metrics.lastFailureTime = Date.now();

    // Si está en HALF_OPEN, volver a OPEN inmediatamente
    if (metrics.state === CircuitState.HALF_OPEN) {
      this.changeState(circuitName, CircuitState.OPEN);
      metrics.successes = 0;
      this.logger.warn(
        `⚠️  Circuit ${circuitName} volvió a OPEN (fallo en prueba)`
      );
    }

    this.logger.warn(
      `⚠️  Fallo registrado en ${circuitName}. ` +
      `Total fallos consecutivos: ${metrics.failures}`
    );
  }

  /**
   * Cambia el estado del circuito
   */
  private changeState(circuitName: string, newState: CircuitState): void {
    const metrics = this.circuits.get(circuitName);
    if (!metrics) return;

    metrics.state = newState;
    metrics.lastStateChange = Date.now();
  }

  /**
   * Obtiene o crea un circuito
   */
  private getOrCreateCircuit(circuitName: string): CircuitMetrics {
    if (!this.circuits.has(circuitName)) {
      this.circuits.set(circuitName, {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastStateChange: Date.now(),
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      });
    }

    return this.circuits.get(circuitName)!;
  }

  /**
   * Obtiene métricas de un circuito específico
   */
  getMetrics(circuitName: string): CircuitMetrics | null {
    return this.circuits.get(circuitName) || null;
  }

  /**
   * Obtiene métricas de todos los circuitos
   */
  getAllMetrics(): Map<string, CircuitMetrics> {
    return new Map(this.circuits);
  }

  /**
   * Resetea manualmente un circuito (útil para testing/admin)
   */
  resetCircuit(circuitName: string): void {
    const metrics = this.circuits.get(circuitName);
    if (metrics) {
      metrics.state = CircuitState.CLOSED;
      metrics.failures = 0;
      metrics.successes = 0;
      metrics.lastStateChange = Date.now();
      this.logger.log(`♻️  Circuit ${circuitName} reseteado manualmente`);
    }
  }

  /**
   * Fuerza el cierre de un circuito (útil para recuperación manual)
   */
  forceClose(circuitName: string): void {
    this.changeState(circuitName, CircuitState.CLOSED);
    const metrics = this.circuits.get(circuitName);
    if (metrics) {
      metrics.failures = 0;
      metrics.successes = 0;
    }
    this.logger.log(`🔓 Circuit ${circuitName} forzado a CLOSED`);
  }

  /**
   * Fuerza la apertura de un circuito (útil para mantenimiento)
   */
  forceOpen(circuitName: string): void {
    this.changeState(circuitName, CircuitState.OPEN);
    this.logger.log(`🔒 Circuit ${circuitName} forzado a OPEN`);
  }
}
