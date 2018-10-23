export interface AddressStatsProperties {
  diagnosticCode?: string;
  readonly email: string;
  lastSendDate?: Date;
  sentCount?: number;
  lastStatus?: string;
  lastStatusDate?: Date;
  spam?: boolean;
  temporaryFailureCount?: number;
}


export class AddressStats implements AddressStatsProperties {
  public diagnosticCode?: string;
  public readonly email: string;
  public lastSendDate?: Date;
  public sentCount?: number;
  public lastStatus?: string;
  public lastStatusDate?: Date;
  public spam: boolean;
  public temporaryFailureCount: number;

  constructor (properties: AddressStatsProperties) {
    this.diagnosticCode = properties.diagnosticCode;
    this.email = properties.email;
    this.lastSendDate = properties.lastSendDate;
    this.sentCount = properties.sentCount;
    this.lastStatus = properties.lastStatus;
    this.lastStatusDate = properties.lastStatusDate;
    this.spam = Boolean(properties.spam);
    this.temporaryFailureCount = properties.temporaryFailureCount || 0;
  }
}
