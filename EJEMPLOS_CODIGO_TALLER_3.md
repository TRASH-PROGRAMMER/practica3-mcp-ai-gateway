# 💻 Ejemplos de Código - Taller 3 MCP

## 📝 Contenido
1. [Crear un Tool Personalizado](#crear-un-tool-personalizado)
2. [Integrar Gemini en un Controller](#integrar-gemini-en-un-controller)
3. [Cliente JSON-RPC](#cliente-json-rpc)
4. [Tests Unitarios](#tests-unitarios)

---

## 1. Crear un Tool Personalizado

### Tool: Buscar Prescripciones por Paciente

```typescript
// apps/mcp-server/src/tools/buscar-prescripcion.tool.ts
import { BackendClient } from '../services/backend-client';
import { ToolDefinition, ToolExecutionContext } from './types';

export const buscarPrescripcionTool: ToolDefinition = {
  name: 'buscar_prescripcion',
  description: 'Busca prescripciones médicas por nombre de paciente o código',
  
  inputSchema: {
    type: 'object',
    properties: {
      paciente: {
        type: 'string',
        description: 'Nombre del paciente o código de prescripción',
      },
    },
    required: ['paciente'],
  },

  async execute(params: any, context: ToolExecutionContext) {
    const { paciente } = params;
    const backendClient = context.backendClient as BackendClient;

    try {
      const prescripciones = await backendClient.buscarPrescripciones({
        paciente,
      });

      if (prescripciones.length === 0) {
        return {
          success: true,
          message: `No se encontraron prescripciones para: "${paciente}"`,
          data: [],
        };
      }

      return {
        success: true,
        message: `Se encontraron ${prescripciones.length} prescripción(es)`,
        data: prescripciones.map((p) => ({
          id: p.id,
          paciente: p.paciente,
          medico: p.medico,
          fecha: p.fecha,
          productos: p.detalles?.map(d => d.productoNombre) || [],
        })),
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error al buscar prescripciones: ${error.message}`,
        data: null,
      };
    }
  },
};
```

### Registrar el Tool

```typescript
// apps/mcp-server/src/tools/registry.ts
import { buscarPrescripcionTool } from './buscar-prescripcion.tool';

export class ToolRegistry {
  private registerDefaultTools() {
    this.register(buscarProductoTool);
    this.register(validarStockTool);
    this.register(crearComparacionTool);
    this.register(buscarPrescripcionTool); // ← Nuevo tool
  }
}
```

---

## 2. Integrar Gemini en un Controller

### Controller con Streaming de Respuestas

```typescript
// apps/api-gateway/src/ia-controller/ia-streaming.controller.ts
import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { GeminiService } from '../gemini/gemini.service';
import { QueryDto } from './dto/query.dto';

@Controller('ia')
export class IaStreamingController {
  constructor(private readonly geminiService: GeminiService) {}

  /**
   * Endpoint con respuesta en streaming (Server-Sent Events)
   */
  @Post('query/stream')
  async processQueryStream(
    @Body() queryDto: QueryDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      // Enviar evento de inicio
      res.write(`data: ${JSON.stringify({ type: 'start', message: 'Procesando...' })}\n\n`);

      // Procesar con callback de progreso
      const result = await this.geminiService.processQueryWithProgress(
        queryDto.message,
        (event) => {
          // Enviar eventos de progreso
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      );

      // Enviar respuesta final
      res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
      res.end();
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
}
```

---

## 3. Cliente JSON-RPC

### Cliente Reutilizable

```typescript
// shared/json-rpc-client.ts
import axios, { AxiosInstance } from 'axios';

export class JsonRpcClient {
  private client: AxiosInstance;
  private requestId = 0;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Envía una petición JSON-RPC 2.0
   */
  async call<T = any>(method: string, params?: any): Promise<T> {
    const request = {
      jsonrpc: '2.0',
      method,
      params,
      id: ++this.requestId,
    };

    const { data } = await this.client.post('/rpc', request);

    if (data.error) {
      throw new Error(
        `JSON-RPC Error [${data.error.code}]: ${data.error.message}`
      );
    }

    return data.result;
  }

  /**
   * Envía múltiples peticiones en batch
   */
  async batch(requests: Array<{ method: string; params?: any }>): Promise<any[]> {
    const jsonRpcRequests = requests.map((req, index) => ({
      jsonrpc: '2.0',
      method: req.method,
      params: req.params,
      id: ++this.requestId + index,
    }));

    const { data } = await this.client.post('/rpc', jsonRpcRequests);

    return Array.isArray(data) ? data.map(d => d.result) : [data.result];
  }
}
```

### Uso del Cliente

```typescript
// Ejemplo de uso
const mcpClient = new JsonRpcClient('http://localhost:3001');

// Llamada simple
const tools = await mcpClient.call('tools/list');

// Llamada con parámetros
const result = await mcpClient.call('tools/call', {
  name: 'buscar_producto',
  arguments: { query: 'paracetamol' },
});

// Batch de llamadas
const results = await mcpClient.batch([
  { method: 'tools/list' },
  { method: 'tools/call', params: { name: 'buscar_producto', arguments: { query: 'ibuprofeno' } } },
  { method: 'health' },
]);
```

---

## 4. Tests Unitarios

### Test para un Tool

```typescript
// apps/mcp-server/src/tools/__tests__/buscar-producto.tool.spec.ts
import { buscarProductoTool } from '../buscar-producto.tool';
import { BackendClient } from '../../services/backend-client';

describe('buscarProductoTool', () => {
  let mockBackendClient: jest.Mocked<BackendClient>;

  beforeEach(() => {
    mockBackendClient = {
      buscarProductos: jest.fn(),
    } as any;
  });

  it('debe retornar productos encontrados', async () => {
    // Arrange
    const mockProductos = [
      { id: 1, nombre: 'Paracetamol 500mg', precio: 2.5, stock: 45 },
      { id: 2, nombre: 'Paracetamol 1g', precio: 4.0, stock: 20 },
    ];
    mockBackendClient.buscarProductos.mockResolvedValue(mockProductos);

    // Act
    const result = await buscarProductoTool.execute(
      { query: 'paracetamol' },
      { backendClient: mockBackendClient }
    );

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.message).toContain('2 producto(s)');
    expect(mockBackendClient.buscarProductos).toHaveBeenCalledWith('paracetamol');
  });

  it('debe manejar productos no encontrados', async () => {
    // Arrange
    mockBackendClient.buscarProductos.mockResolvedValue([]);

    // Act
    const result = await buscarProductoTool.execute(
      { query: 'noexiste' },
      { backendClient: mockBackendClient }
    );

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(result.message).toContain('No se encontraron productos');
  });

  it('debe manejar errores del backend', async () => {
    // Arrange
    mockBackendClient.buscarProductos.mockRejectedValue(
      new Error('Connection timeout')
    );

    // Act
    const result = await buscarProductoTool.execute(
      { query: 'test' },
      { backendClient: mockBackendClient }
    );

    // Assert
    expect(result.success).toBe(false);
    expect(result.message).toContain('Error al buscar productos');
  });
});
```

### Test para GeminiService

```typescript
// apps/api-gateway/src/gemini/__tests__/gemini.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from '../gemini.service';
import { McpClientService } from '../../mcp-client/mcp-client.service';

describe('GeminiService', () => {
  let service: GeminiService;
  let mcpClient: jest.Mocked<McpClientService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'GEMINI_API_KEY') return 'test-key';
              if (key === 'GEMINI_MODEL') return 'gemini-2.0-flash-exp';
              return null;
            }),
          },
        },
        {
          provide: McpClientService,
          useValue: {
            listTools: jest.fn(),
            callTool: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
    mcpClient = module.get(McpClientService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe procesar una consulta simple', async () => {
    // Arrange
    const mockTools = [
      { name: 'buscar_producto', description: 'Busca productos...', parameters: {} },
    ];
    mcpClient.listTools.mockResolvedValue(mockTools);
    mcpClient.callTool.mockResolvedValue({
      success: true,
      data: [{ id: 1, nombre: 'Test' }],
    });

    // Act
    const result = await service.processQuery('Busca paracetamol');

    // Assert
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('toolsExecuted');
    expect(mcpClient.listTools).toHaveBeenCalled();
  });
});
```

### Test de Integración

```typescript
// apps/api-gateway/test/ia.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('IA Controller (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ia/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/ia/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('success');
        expect(res.body).toHaveProperty('gateway');
      });
  });

  it('/ia/tools (GET)', () => {
    return request(app.getHttpServer())
      .get('/ia/tools')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.tools).toBeInstanceOf(Array);
      });
  });

  it('/ia/query (POST) - buscar producto', () => {
    return request(app.getHttpServer())
      .post('/ia/query')
      .send({ message: 'Busca paracetamol' })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty('response');
        expect(res.body).toHaveProperty('toolsExecuted');
      });
  });
});
```

---

## 5. Middleware y Logging

### Middleware de Logging para MCP Server

```typescript
// apps/mcp-server/src/middleware/logging.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // Agregar requestId al request
  (req as any).requestId = requestId;

  // Log de request
  logger.info(`📥 Request ${requestId}`, {
    method: req.method,
    url: req.url,
    body: req.body,
  });

  // Interceptar response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - start;
    
    logger.info(`📤 Response ${requestId}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });

    return originalSend.call(this, data);
  };

  next();
}
```

### Uso del Middleware

```typescript
// apps/mcp-server/src/server.ts
import { loggingMiddleware } from './middleware/logging.middleware';

app.use(express.json());
app.use(loggingMiddleware); // ← Agregar middleware
```

---

## 6. Configuración Avanzada de Gemini

### Configuración con Parámetros de Generación

```typescript
// apps/api-gateway/src/gemini/gemini.service.ts
this.model = this.genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  tools: [{ functionDeclarations: geminiTools }],
  generationConfig: {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 1024,
  },
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
  ],
});
```

---

**Ejemplos completos y funcionales! 🎯**
