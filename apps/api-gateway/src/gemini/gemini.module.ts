import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { McpClientModule } from '../mcp-client/mcp-client.module';

@Module({
  imports: [McpClientModule],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
