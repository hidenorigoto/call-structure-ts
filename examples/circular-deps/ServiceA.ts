import { ServiceB } from './ServiceB';

export class ServiceA {
  private serviceB: ServiceB;
  
  constructor() {
    this.serviceB = new ServiceB();
  }
  
  methodA(): void {
    console.log('ServiceA.methodA called');
    this.serviceB.methodB();
  }
  
  anotherMethodA(): string {
    console.log('ServiceA.anotherMethodA called');
    return 'Result from A';
  }
  
  callServiceB(): void {
    this.serviceB.methodB();
    this.serviceB.anotherMethodB();
  }
}