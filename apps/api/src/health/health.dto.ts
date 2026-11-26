import { ApiProperty } from '@nestjs/swagger';
import { type HealthResponse } from '@erp/shared';

class HealthChecksDto {
  @ApiProperty({ enum: ['up', 'down'] })
  database!: 'up' | 'down';
}

/** OpenAPI description of the shared HealthResponse type. */
export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @ApiProperty({ enum: ['api'] })
  service!: 'api';

  @ApiProperty({ example: '0.0.0' })
  version!: string;

  @ApiProperty({ example: '2026-11-26T09:30:00.000Z' })
  time!: string;

  @ApiProperty({ type: HealthChecksDto })
  checks!: HealthChecksDto;
}
