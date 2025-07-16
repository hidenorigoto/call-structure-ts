import { validateConfig } from '../utils/validators';

interface Config {
  database: {
    host: string;
    port: number;
    name: string;
  };
  auth: {
    secret: string;
    expiresIn: string;
  };
  api: {
    port: number;
    baseUrl: string;
  };
}

export class ConfigService {
  private config: Config;

  async load(): Promise<void> {
    this.config = await this.loadFromEnvironment();
    validateConfig(this.config);
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  getDatabase(): Config['database'] {
    return this.config.database;
  }

  getAuth(): Config['auth'] {
    return this.config.auth;
  }

  private async loadFromEnvironment(): Promise<Config> {
    return {
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        name: process.env.DB_NAME || 'testdb',
      },
      auth: {
        secret: process.env.AUTH_SECRET || 'secret',
        expiresIn: process.env.AUTH_EXPIRES || '1h',
      },
      api: {
        port: parseInt(process.env.API_PORT || '3000'),
        baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
      },
    };
  }
}
