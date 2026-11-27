import { Controller, Get, HttpCode, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { type HealthResponse } from '@erp/shared';
import { Public } from '../auth/decorators';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { HealthResponseDto } from './health.dto';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Liveness and status: always 200 while the process runs; reports database state. */
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  async health(): Promise<HealthResponse> {
    return this.build(await this.prisma.isHealthy());
  }

  /** Readiness: 503 until the database answers. Used by Docker and load balancers. */
  @Get('ready')
  @HttpCode(200)
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ description: 'Database is not reachable' })
  async ready(): Promise<HealthResponse> {
    const body = this.build(await this.prisma.isHealthy());
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }

  private build(databaseUp: boolean): HealthResponse {
    return {
      status: databaseUp ? 'ok' : 'degraded',
      service: 'api',
      version: this.env.APP_VERSION,
      time: new Date().toISOString(),
      checks: { database: databaseUp ? 'up' : 'down' },
    };
  }
}
