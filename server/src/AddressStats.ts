export interface AddressStatsProperties {
  readonly email: string;
  lastSendDate: Date;
  sentCount: number;
  lastStatus?: string;
  lastStatusDate?: Date;
  temporaryFailureCount?: number;
}


export class AddressStats implements AddressStatsProperties {
  public readonly email: string;
  public lastSendDate: Date;
  public sentCount: number;
  public lastStatus?: string;
  public lastStatusDate?: Date;
  public temporaryFailureCount: number;

  constructor (properties: AddressStatsProperties) {
    this.email = properties.email;
    this.lastSendDate = properties.lastSendDate;
    this.sentCount = properties.sentCount;
    this.lastStatus = properties.lastStatus;
    this.lastStatusDate = properties.lastStatusDate;
    this.temporaryFailureCount = properties.temporaryFailureCount || 0;
  }
}
