import * as React from 'react';
import { MailingState } from 'server/src/Mailing';


interface MailingStateViewProps {
  state: MailingState;
}

export class MailingStateView extends React.Component<MailingStateViewProps> {
  render () {
    return {
      [MailingState.NEW]: 'Новая',
      [MailingState.RUNNING]: 'Выполняется',
      [MailingState.PAUSED]: 'Приостановлена',
      [MailingState.FINISHED]: 'Завершена'
    }[this.props.state];
  }
}
