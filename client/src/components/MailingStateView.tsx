import * as React from 'react';
import { MailingState } from '../../../server/src/MailingState';
import '../styles/MailingStateView';
import { StateMarker } from './StateMarker';


interface MailingStateViewProps {
  state: MailingState;
}

export const mailingStateNames: Record<MailingState, string> = {
  [MailingState.NEW]: 'Новая',
  [MailingState.RUNNING]: 'Выполняется',
  [MailingState.PAUSED]: 'Приостановлена',
  [MailingState.FINISHED]: 'Завершена',
  [MailingState.ERROR]: 'Приостановлена из-за ошибки'
};

export class MailingStateView extends React.Component<MailingStateViewProps> {
  render () {
    return (
      <span className='mailing-state'>
        <StateMarker state={this.props.state} />
        {mailingStateNames[this.props.state]}
      </span>
    );
  }
}
