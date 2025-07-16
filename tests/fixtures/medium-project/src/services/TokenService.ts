interface AuthConfig {
  secret: string;
  expiresIn: string;
}

export class TokenService {
  constructor(private config: AuthConfig) {}

  sign(payload: any): string {
    // Simulate JWT signing
    return Buffer.from(
      JSON.stringify({
        payload,
        exp: Date.now() + this.parseExpiry(this.config.expiresIn),
      })
    ).toString('base64');
  }

  verify(token: string): any {
    try {
      // Simulate JWT verification
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

      if (Date.now() > decoded.exp) {
        throw new Error('Token expired');
      }

      return decoded.payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  private parseExpiry(expiresIn: string): number {
    const match = expiresIn.match(/(\d+)([smhd])/);
    if (!match) {
      return 3600000; // Default 1 hour
    }

    const [, value, unit] = match;
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return parseInt(value) * (multipliers[unit] || 1000);
  }
}
