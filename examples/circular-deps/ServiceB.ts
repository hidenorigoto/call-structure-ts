import { ServiceA } from './ServiceA';

export class ServiceB {
  private serviceA: ServiceA;
  
  constructor() {
    this.serviceA = new ServiceA();
  }
  
  methodB(): void {
    console.log('ServiceB.methodB called');
    this.serviceA.methodA(); // Circular!
  }
  
  anotherMethodB(): string {
    console.log('ServiceB.anotherMethodB called');
    const result = this.serviceA.anotherMethodA();
    return `Enhanced: ${result}`;
  }
  
  independentMethod(): void {
    console.log('ServiceB.independentMethod - no circular call');
  }
}