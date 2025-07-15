// Helper utilities

export class Helper {
  // Static method example
  static staticMethod(): string {
    return 'static result';
  }

  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  static parseJSON(json: string): any {
    try {
      return JSON.parse(json);
    } catch (error) {
      return null;
    }
  }
}

export function utilityFunction(): void {
  console.log('Utility function called');
}

export const arrowUtility = (): void => {
  console.log('Arrow utility called');
};
