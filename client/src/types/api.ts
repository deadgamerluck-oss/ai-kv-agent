export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  service: string;
  database?: {
    provider: string;
    status: 'connected' | 'mock_mode' | 'schema_missing' | 'unavailable' | string;
  };
}

export interface VersionInfo {
  name: string;
  version: string;
  environment: string;
}
