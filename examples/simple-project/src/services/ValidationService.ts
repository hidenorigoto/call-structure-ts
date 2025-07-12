export class ValidationService {
  validate(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      return false;
    }

    if (!data.email || typeof data.email !== 'string' || !this.isValidEmail(data.email)) {
      return false;
    }

    return true;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validateRequired(value: any, fieldName: string): void {
    if (!value || (typeof value === 'string' && value.trim().length === 0)) {
      throw new Error(`${fieldName} is required`);
    }
  }
}