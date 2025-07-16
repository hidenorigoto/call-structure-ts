import { ConfigService } from '../services/ConfigService';
import { Logger } from '../utils/Logger';
import { TokenService } from '../services/TokenService';

export class AuthMiddleware {
  private tokenService: TokenService;

  constructor(
    private config: ConfigService,
    private logger: Logger
  ) {
    this.tokenService = new TokenService(config.getAuth());
  }

  isAuthorized(request: any): boolean {
    const token = this.extractToken(request);

    if (!token) {
      this.logger.warn('No token provided');
      return false;
    }

    try {
      const payload = this.tokenService.verify(token);
      this.attachUserToRequest(request, payload);
      return true;
    } catch (error) {
      this.logger.error('Token verification failed', error);
      return false;
    }
  }

  private extractToken(request: any): string | null {
    if (request.headers?.authorization) {
      return request.headers.authorization.replace('Bearer ', '');
    }
    return request.token || null;
  }

  private attachUserToRequest(request: any, payload: any): void {
    request.user = payload;
  }
}
