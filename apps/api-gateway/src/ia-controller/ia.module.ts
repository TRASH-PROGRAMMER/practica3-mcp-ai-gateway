import { Module } from '@nestjs/common';
import { IaController } from './ia.controller';
import { GeminiModule } from '../gemini/gemini.module';
import { McpClientModule } from '../mcp-client/mcp-client.module';

@Module({
  imports: [GeminiModule, McpClientModule],
  controllers: [IaController],
})
export class IaModule {}
