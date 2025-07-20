import { Order } from '../../domain/entities/Order';
import { Customer } from '../../domain/entities/Customer';
import { EmailService } from '../../infrastructure/external/EmailService';
import { SMSService } from '../../infrastructure/external/SMSService';

export interface NotificationResult {
  success: boolean;
  method: 'email' | 'sms';
  message?: string;
  error?: string;
}

export class NotificationService {
  constructor(
    private readonly emailService: EmailService,
    private readonly smsService: SMSService
  ) {}

  async notifyOrderCreated(order: Order, customer: Customer): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    
    // Send email notification
    try {
      const emailSubject = 'Order Confirmation';
      const emailBody = this.buildOrderCreatedEmailBody(order, customer);
      await this.emailService.sendEmail(
        customer.getEmail(),
        emailSubject,
        emailBody
      );
      results.push({ success: true, method: 'email' });
    } catch (error) {
      console.error('Failed to send order creation email:', error);
      results.push({ 
        success: false, 
        method: 'email', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    // Send SMS notification if phone number is available
    if (customer.getPhone()) {
      try {
        const smsMessage = this.buildOrderCreatedSMSMessage(order);
        await this.smsService.sendSMS(customer.getPhone(), smsMessage);
        results.push({ success: true, method: 'sms' });
      } catch (error) {
        console.error('Failed to send order creation SMS:', error);
        results.push({ 
          success: false, 
          method: 'sms', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return results;
  }

  async notifyOrderConfirmed(order: Order, customer: Customer): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    
    try {
      const emailSubject = 'Order Confirmed';
      const emailBody = this.buildOrderConfirmedEmailBody(order, customer);
      await this.emailService.sendEmail(
        customer.getEmail(),
        emailSubject,
        emailBody
      );
      results.push({ success: true, method: 'email' });
    } catch (error) {
      console.error('Failed to send order confirmation email:', error);
      results.push({ 
        success: false, 
        method: 'email', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    return results;
  }

  async notifyOrderCancelled(order: Order, customer: Customer): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    
    try {
      const emailSubject = 'Order Cancelled';
      const emailBody = this.buildOrderCancelledEmailBody(order, customer);
      await this.emailService.sendEmail(
        customer.getEmail(),
        emailSubject,
        emailBody
      );
      results.push({ success: true, method: 'email' });
    } catch (error) {
      console.error('Failed to send order cancellation email:', error);
      results.push({ 
        success: false, 
        method: 'email', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    // Also send SMS for cancellation
    if (customer.getPhone()) {
      try {
        const smsMessage = `Your order ${order.getId()} has been cancelled. If you have any questions, please contact support.`;
        await this.smsService.sendSMS(customer.getPhone(), smsMessage);
        results.push({ success: true, method: 'sms' });
      } catch (error) {
        console.error('Failed to send order cancellation SMS:', error);
        results.push({ 
          success: false, 
          method: 'sms', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return results;
  }

  private buildOrderCreatedEmailBody(order: Order, customer: Customer): string {
    const total = order.calculateTotal();
    const items = order.getItems()
      .map(item => `- ${item.product.getName()} x${item.quantity} - ${item.unitPrice.getAmount()} ${item.unitPrice.getCurrency()}`)
      .join('\n');

    return `
Dear ${customer.getName()},

Thank you for your order! We're pleased to confirm that we've received your order.

Order Details:
Order ID: ${order.getId()}
Order Date: ${new Date().toLocaleString()}

Items:
${items}

Total: ${total.getAmount()} ${total.getCurrency()}

Shipping Address: ${order.getShippingAddress() ? order.getShippingAddress().getFullAddress() : 'Not specified'}

We'll send you another email when your order has been confirmed and is being processed.

Best regards,
The Order Team
    `.trim();
  }

  private buildOrderCreatedSMSMessage(order: Order): string {
    const total = order.calculateTotal();
    return `Order ${order.getId()} received! Total: ${total.getAmount()} ${total.getCurrency()}. We'll notify you when it's confirmed.`;
  }

  private buildOrderConfirmedEmailBody(order: Order, customer: Customer): string {
    return `
Dear ${customer.getName()},

Great news! Your order ${order.getId()} has been confirmed and is now being processed.

We'll notify you once your order has been shipped.

Best regards,
The Order Team
    `.trim();
  }

  private buildOrderCancelledEmailBody(order: Order, customer: Customer): string {
    return `
Dear ${customer.getName()},

We're writing to confirm that your order ${order.getId()} has been cancelled as requested.

If you didn't request this cancellation or have any questions, please contact our support team immediately.

Best regards,
The Order Team
    `.trim();
  }
}