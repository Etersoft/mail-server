export interface AddressStatsProperties {
  readonly email: string;
  lastSendDate: Date;
  sentCount: number;
  lastStatus?: string;
  lastStatusDate?: Date;
}


export class AddressStats implements AddressStatsProperties {
  public readonly email: string;
  public lastSendDate: Date;
  public sentCount: number;
  public lastStatus?: string;
  public lastStatusDate?: Date;

  constructor (properties: AddressStatsProperties) {
    this.email = properties.email;
    this.lastSendDate = properties.lastSendDate;
    this.sentCount = properties.sentCount;
    this.lastStatus = properties.lastStatus;
    this.lastStatusDate = properties.lastStatusDate;
  }
}
