import * as React from 'react';
import { Mailing } from '../reducers/mailings';
import '../styles/MailingDetailView';
import { MailingStateView } from './MailingStateView';
import { MailingState } from 'server/src/Mailing';
import { Button } from './elements/Button';


export interface MailingDetailViewProps {
  mailing: Mailing;
  onStart?: (mailing: Mailing) => void;
  onStop?: (mailing: Mailing) => void;
}

export class MailingDetailView extends React.Component<MailingDetailViewProps> {
  render () {
    const { mailing } = this.props;
    const receivers = mailing.receivers ? mailing.receivers.length : '(загрузка)';
    return (
      <div className='mailing-detail-view'>
        <h2 className='header'>
          Рассылка: {mailing.name}
        </h2>
        <div className='details'>
          <h5 className='field-name'>Название: </h5>
          <span className='field-value'>{mailing.name}</span><br />

          <h5 className='field-name'>Состояние: </h5>
          <span className='field-value'><MailingStateView state={mailing.state} /></span><br />

          <h5 className='field-name'>Получатели: </h5>
          <span className='field-value'>{receivers}</span><br />

          <h5 className='field-name'>Отправлено: </h5>
          <span className='field-value'>{mailing.sentCount}</span><br />
          <br />
          {this.renderButtons()}
        </div>
      </div>
    );
  }

  renderButtons () {
    const { mailing } = this.props;
    if (mailing.state === MailingState.FINISHED) {
      return null;
    } else if (mailing.state === MailingState.RUNNING) {
      return (
        <Button disabled={mailing.locked} onClick={this.handleStop}>
          Приостановить рассылку
        </Button>
      );
    } else {
      return (
        <Button disabled={mailing.locked} onClick={this.handleStart}>
          Запустить рассылку
        </Button>
      );
    }
  }


  private handleStart = () => {
    if (this.props.onStart) {
      this.props.onStart(this.props.mailing);
    }
  }

  private handleStop = () => {
    if (this.props.onStop) {
      this.props.onStop(this.props.mailing);
    }
  }
}
