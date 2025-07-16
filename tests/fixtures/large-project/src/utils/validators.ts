export function validateConfig(config: any): void {
  if (!config.database || !config.auth || !config.api) {
    throw new Error('Invalid configuration: missing required sections');
  }
}

export function validateUser(data: any): void {
  if (!data.email || !data.name) {
    throw new Error('Invalid user data: email and name are required');
  }

  if (!isValidEmail(data.email)) {
    throw new Error('Invalid email format');
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
