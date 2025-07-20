import { Address } from '../../domain/value-objects/Address';

export interface OrderItemDTO {
  productId: string;
  quantity: number;
}

export interface CreateOrderDTO {
  customerId: string;
  items: OrderItemDTO[];
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod?: string;
}