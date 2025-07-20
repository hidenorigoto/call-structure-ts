import { Money } from '../value-objects/Money';
import { Order } from '../entities/Order';
import { Customer } from '../entities/Customer';
import { Product } from '../entities/Product';

export class PricingService {
  private readonly TAX_RATE = 0.08; // 8% tax
  private readonly VIP_DISCOUNT_RATE = 0.1; // 10% discount for VIP customers
  private readonly BULK_DISCOUNT_THRESHOLD = 10; // Bulk discount for 10+ items
  private readonly BULK_DISCOUNT_RATE = 0.05; // 5% bulk discount

  public calculateOrderTotal(order: Order, customer: Customer): {
    subtotal: Money;
    discount: Money;
    tax: Money;
    total: Money;
  } {
    const subtotal = order.calculateTotal();
    const discount = this.calculateDiscount(subtotal, customer);
    const subtotalAfterDiscount = subtotal.subtract(discount);
    const tax = this.calculateTax(subtotalAfterDiscount);
    const total = subtotalAfterDiscount.add(tax);

    return {
      subtotal,
      discount,
      tax,
      total
    };
  }

  private calculateDiscount(amount: Money, customer: Customer): Money {
    // Simple discount logic - in real world, this would be more complex
    // For now, just check if customer has placed more than 5 orders (mock VIP status)
    const isVip = this.isVipCustomer(customer);
    
    if (isVip) {
      return amount.multiply(this.VIP_DISCOUNT_RATE);
    }
    
    return new Money(0, amount.getCurrency());
  }

  private calculateTax(amount: Money): Money {
    return amount.multiply(this.TAX_RATE);
  }

  private isVipCustomer(customer: Customer): boolean {
    // Mock implementation - in real world, this would check customer's order history
    return customer.getEmail().includes('vip');
  }

  public calculateShippingCost(order: Order, _destination: string): Money {
    const baseShippingCost = 10; // Base shipping cost
    const perItemCost = 2; // Additional cost per item
    
    const itemCount = order.getItems().reduce((sum, item) => sum + item.quantity, 0);
    const shippingCost = baseShippingCost + (itemCount * perItemCost);
    
    // Assume USD for simplicity
    return new Money(shippingCost, 'USD');
  }

  public async calculatePrice(
    product: Product,
    quantity: number,
    customer: Customer
  ): Promise<Money> {
    console.log(`[PricingService] Calculating price for ${quantity} units of ${product.getName()}`);
    
    const basePrice = product.getPrice();
    let finalPrice = basePrice.multiply(quantity);
    
    // Apply bulk discount if applicable
    if (quantity >= this.BULK_DISCOUNT_THRESHOLD) {
      const bulkDiscount = finalPrice.multiply(this.BULK_DISCOUNT_RATE);
      finalPrice = finalPrice.subtract(bulkDiscount);
      console.log(`[PricingService] Applied bulk discount: ${bulkDiscount.getAmount()}`);
    }
    
    // Apply VIP discount if applicable
    if (this.isVipCustomer(customer)) {
      const vipDiscount = finalPrice.multiply(this.VIP_DISCOUNT_RATE);
      finalPrice = finalPrice.subtract(vipDiscount);
      console.log(`[PricingService] Applied VIP discount: ${vipDiscount.getAmount()}`);
    }
    
    // For individual item pricing, we return the unit price after discounts
    const unitPrice = new Money(finalPrice.getAmount() / quantity, finalPrice.getCurrency());
    
    console.log(`[PricingService] Final unit price: ${unitPrice.getAmount()} ${unitPrice.getCurrency()}`);
    return unitPrice;
  }
}