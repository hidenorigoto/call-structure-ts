import { DatabaseService } from '../services/DatabaseService';
import { PaymentService } from '../services/PaymentService';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { Logger } from '../utils/Logger';
import { AuditLogger } from '../utils/AuditLogger';

export class PaymentController {
  private paymentService: PaymentService;
  private auditLogger: AuditLogger;

  constructor(
    private db: DatabaseService,
    private auth: AuthMiddleware,
    private logger: Logger
  ) {
    this.paymentService = new PaymentService();
    this.auditLogger = new AuditLogger();
  }

  async handleRequest(request: any): Promise<any> {
    this.logger.info(`Handling payment request: ${request.action}`);

    if (!this.auth.isAuthorized(request)) {
      throw new Error('Unauthorized');
    }

    try {
      const result = await this.processPaymentAction(request);
      await this.auditLogger.logPaymentAction(request, result);
      return result;
    } catch (error) {
      await this.auditLogger.logPaymentError(request, error);
      throw error;
    }
  }

  private async processPaymentAction(request: any): Promise<any> {
    switch (request.action) {
      case 'charge':
        return this.chargePayment(request.data);
      case 'refund':
        return this.refundPayment(request.paymentId, request.amount);
      case 'status':
        return this.getPaymentStatus(request.paymentId);
      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  private async chargePayment(data: any): Promise<any> {
    const payment = await this.paymentService.createCharge(data);
    await this.db.getPaymentRepository().save(payment);
    return payment;
  }

  private async refundPayment(paymentId: string, amount: number): Promise<any> {
    const refund = await this.paymentService.createRefund(paymentId, amount);
    await this.db.getPaymentRepository().saveRefund(refund);
    return refund;
  }

  private async getPaymentStatus(paymentId: string): Promise<any> {
    return this.db.getPaymentRepository().findById(paymentId);
  }
}
