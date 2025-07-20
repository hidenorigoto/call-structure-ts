import { Order } from '../entities/Order';

export class InventoryService {
  // In-memory inventory tracking for demo purposes
  private inventory: Map<string, number> = new Map();
  private reservations: Map<string, Map<string, number>> = new Map(); // orderId -> productId -> quantity

  constructor() {
    // Initialize with some test inventory
    this.initializeInventory();
  }

  public async checkAvailability(productId: string, quantity: number): Promise<boolean> {
    console.log(`[InventoryService] Checking availability for product ${productId}, quantity: ${quantity}`);
    
    const available = this.inventory.get(productId) || 0;
    const reserved = this.getTotalReserved(productId);
    const actualAvailable = available - reserved;
    
    console.log(`[InventoryService] Product ${productId}: ${actualAvailable} available (${available} total, ${reserved} reserved)`);
    
    return actualAvailable >= quantity;
  }

  public async reserveStock(productId: string, quantity: number, orderId?: string): Promise<void> {
    const tempOrderId = orderId || `temp-${Date.now()}`;
    console.log(`[InventoryService] Reserving ${quantity} units of product ${productId} for order ${tempOrderId}`);
    
    const isAvailable = await this.checkAvailability(productId, quantity);
    if (!isAvailable) {
      throw new Error(`Insufficient inventory for product ${productId}`);
    }
    
    // Create reservation
    if (!this.reservations.has(tempOrderId)) {
      this.reservations.set(tempOrderId, new Map());
    }
    
    const orderReservations = this.reservations.get(tempOrderId)!;
    const currentReserved = orderReservations.get(productId) || 0;
    orderReservations.set(productId, currentReserved + quantity);
    
    console.log(`[InventoryService] Reserved ${quantity} units successfully`);
  }

  public async confirmReservation(productId: string, quantity: number): Promise<void> {
    console.log(`[InventoryService] Confirming reservation for ${quantity} units of product ${productId}`);
    
    // In a real system, this would convert a reservation into a committed inventory change
    // For demo purposes, we'll just reduce the inventory
    const current = this.inventory.get(productId) || 0;
    if (current < quantity) {
      throw new Error(`Insufficient inventory to confirm reservation for product ${productId}`);
    }
    
    this.inventory.set(productId, current - quantity);
    console.log(`[InventoryService] Reservation confirmed, inventory updated`);
  }

  public async releaseStock(productId: string, quantity: number): Promise<void> {
    console.log(`[InventoryService] Releasing ${quantity} units of product ${productId}`);
    
    // Return stock to inventory
    const current = this.inventory.get(productId) || 0;
    this.inventory.set(productId, current + quantity);
    
    console.log(`[InventoryService] Stock released successfully`);
  }

  public async reserveProducts(order: Order): Promise<void> {
    console.log(`[InventoryService] Reserving products for order ${order.getId()}`);
    
    for (const item of order.getItems()) {
      await this.reserveStock(item.product.getId(), item.quantity, order.getId());
    }
    
    console.log(`[InventoryService] All products reserved for order ${order.getId()}`);
  }

  public async releaseProducts(order: Order): Promise<void> {
    console.log(`[InventoryService] Releasing products for order ${order.getId()}`);
    
    const orderReservations = this.reservations.get(order.getId());
    if (orderReservations) {
      for (const [productId, quantity] of orderReservations.entries()) {
        await this.releaseStock(productId, quantity);
      }
      this.reservations.delete(order.getId());
    }
    
    console.log(`[InventoryService] All products released for order ${order.getId()}`);
  }

  private getTotalReserved(productId: string): number {
    let total = 0;
    for (const orderReservations of this.reservations.values()) {
      total += orderReservations.get(productId) || 0;
    }
    return total;
  }

  private initializeInventory(): void {
    // Initialize with test inventory matching the products
    this.inventory.set('product-001', 100); // Laptop
    this.inventory.set('product-002', 250); // Mouse
    this.inventory.set('product-003', 150); // USB-C Hub
    this.inventory.set('product-004', 75);  // Keyboard
    this.inventory.set('product-005', 50);  // Monitor
    
    console.log(`[InventoryService] Initialized inventory for ${this.inventory.size} products`);
  }
}