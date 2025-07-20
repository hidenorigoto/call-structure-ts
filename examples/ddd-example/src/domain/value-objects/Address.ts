export class Address {
  private readonly street: string;
  private readonly city: string;
  private readonly state: string;
  private readonly zipCode: string;
  private readonly country: string;

  constructor(street: string, city: string, state: string, zipCode: string, country: string) {
    this.street = street;
    this.city = city;
    this.state = state;
    this.zipCode = zipCode;
    this.country = country;
    this.validate();
  }

  private validate(): void {
    if (!this.street || !this.city || !this.state || !this.zipCode || !this.country) {
      throw new Error('All address fields are required');
    }
  }

  public getFullAddress(): string {
    return `${this.street}, ${this.city}, ${this.state} ${this.zipCode}, ${this.country}`;
  }

  public equals(other: Address): boolean {
    return (
      this.street === other.street &&
      this.city === other.city &&
      this.state === other.state &&
      this.zipCode === other.zipCode &&
      this.country === other.country
    );
  }

  public toJSON(): object {
    return {
      street: this.street,
      city: this.city,
      state: this.state,
      zipCode: this.zipCode,
      country: this.country
    };
  }
}