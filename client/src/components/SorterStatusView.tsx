import * as React from 'react';
import '../styles/SorterStatusView';
import { getSorterStatus, SorterStatusView as Status } from '../api';
import { formatDate } from '../formatDate';


const REFRESH_INTERVAL = 60 * 1000;

const typeNames: Record<string, string> = {
  AUTORESPONDER: 'автоответы',
  HUMAN: 'от людей',
  MAIL_SERVER: 'недоставки',
  UNSUBSCRIBE: 'отписки'
};

// Действия, которые стоит показать; остальные (отметка о прочтении,
// обновление статистики) — служебные
const actionNames: [string, string][] = [
  ['disabled emails', 'исключено адресов'],
  ['unsubscribe', 'отписано'],
  ['forwarded', 'переслано писем']
];

function countActions (actions: Record<string, number> = {}) {
  return actionNames.map(([prefix, name]): [string, number] => [
    name,
    Object.entries(actions)
      .filter(([action]) => action.startsWith(prefix))
      .reduce((sum, [, count]) => sum + count, 0)
  ]).filter(([, count]) => count > 0);
}

interface SorterStatusViewState {
  error?: string;
  loaded: boolean;
  status: Status | null;
}

/**
 * Итог последнего запуска mail-sorter (разбор ответов на рассылки)
 */
export class SorterStatusView extends React.Component<object, SorterStatusViewState> {
  state: SorterStatusViewState = { loaded: false, status: null };
  private timer?: ReturnType<typeof setInterval>;

  componentDidMount () {
    this.load();
    this.timer = setInterval(() => this.load(), REFRESH_INTERVAL);
  }

  componentWillUnmount () {
    clearInterval(this.timer);
  }

  render () {
    return (
      <div className='sorter-status'>
        <h3 className='block-header'>Разбор ответов (mail-sorter)</h3>
        <div className='sorter-status-body'>
          {this.renderBody()}
        </div>
      </div>
    );
  }

  private renderBody () {
    const { error, loaded, status } = this.state;
    if (error) {
      return <div className='warning'>Не удалось получить состояние: {error}</div>;
    }
    if (!loaded) {
      return null;
    }
    if (!status) {
      return <div className='warning'>mail-sorter ещё ни разу не запускался</div>;
    }

    const types = Object.entries(status.types || {})
      .map(([type, count]) => `${typeNames[type] || type} ${count}`);
    const actions = countActions(status.actions).map(([name, count]) => `${name} ${count}`);
    const failed = status.counters ? status.counters.failed : 0;
    return (
      <>
        {status.stale ? (
          <div className='warning'>
            {status.lastSuccessAt ?
              `Нет успешного запуска с ${formatDate(new Date(status.lastSuccessAt))}` :
              'Ещё не было успешного запуска'}
          </div>
        ) : null}
        <div>
          Последний запуск: {formatDate(new Date(status.finishedAt))}
          {status.readonly ? ', пробный (ничего не менялось)' : null}
          {status.success ? null : <span className='error'>, ошибка: {status.error}</span>}
        </div>
        {status.success ? (
          <div>Писем: {types.length ? types.join(', ') : 'новых нет'}</div>
        ) : null}
        {actions.length ? <div>{actions.join(', ')}</div> : null}
        {failed ? (
          <div className='error'>
            Не удалось обработать писем: {failed}
            {status.failedMessages && status.failedMessages.length ?
              ` (№ ${status.failedMessages.join(', ')})` : null}
          </div>
        ) : null}
      </>
    );
  }

  private async load () {
    try {
      const status = await getSorterStatus();
      this.setState({ error: undefined, loaded: true, status });
    } catch (error) {
      this.setState({ error: (error as Error).message });
    }
  }
}
