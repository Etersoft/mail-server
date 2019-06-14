import { AddressStatsProperties, AddressStats } from './AddressStats';


/**
 * Интерфейс хранилища, содержащего информацию о статистике ошибок
 * и отправок по конкретным адресам
 */
export interface AddressStatsRepository {
  create (properties: AddressStatsProperties): Promise<AddressStats>;
  getByEmail (email: string): Promise<AddressStats | null>;
  getBatchStats (emails: string[]): Promise<(AddressStats | null)[]>;
  update (mailing: AddressStats): Promise<void>;
  updateInTransaction (
    email: string, scenario: (stats: AddressStats) => Promise<void>
  ): Promise<AddressStats | null>;
}
