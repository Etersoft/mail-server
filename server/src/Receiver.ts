export interface ReceiverProperties {
  email: string;
  name: string;
}


/**
 * Класс получателя рассылки
 */
export class Receiver {
  constructor (
    public email: string,
    public name?: string
  ) {}

  getStringRepresentation () {
    if (typeof this.name === 'string') {
      return `${this.name} <${this.email}>`;
    } else {
      return this.email;
    }
  }

  toString () {
    return this.getStringRepresentation();
  }
}