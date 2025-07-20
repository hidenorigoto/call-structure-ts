import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const user = request.user;

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const contentLength = response.get('content-length');
          const responseTime = Date.now() - now;

          this.logger.log(
            `${method} ${url} ${statusCode} ${contentLength} - ${userAgent} ${ip} ${
              user ? `userId:${user.id}` : 'anonymous'
            } +${responseTime}ms`,
          );
        },
        error: (error) => {
          const response = context.switchToHttp().getResponse();
          const responseTime = Date.now() - now;

          this.logger.error(
            `${method} ${url} ${error.status || 500} - ${userAgent} ${ip} ${
              user ? `userId:${user.id}` : 'anonymous'
            } +${responseTime}ms`,
            error.stack,
          );
        },
      }),
    );
  }
}