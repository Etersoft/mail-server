import * as React from 'react';
import { Mailing } from '../reducers/mailings';
import '../styles/MailingDetailView';
import { MailingStateView } from './MailingStateView';
import { MailingState } from 'server/src/Mailing';
import { Button, ButtonType } from './elements/Button';
import { setInterval } from 'timers';
import { ConfirmationButton } from './elements/ConfirmationButton';


const REFRESH_INTERVAL = 1000;

export interface MailingDetailViewProps {
  mailing: Mailing;
  onDelete: (mailing: Mailing) => void;
  onRefresh?: (mailing: Mailing) => void;
  onStart?: (mailing: Mailing) => void;
  onStop?: (mailing: Mailing) => void;
}

export class MailingDetailView extends React.Component<MailingDetailViewProps> {
  private refreshInterval: NodeJS.Timer;

  componentDidMount () {
    this.refreshInterval = setInterval(this.refresh, REFRESH_INTERVAL);
  }

  componentWillUnmount () {
    clearInterval(this.refreshInterval);
  }

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
          {this.renderStateButton()}
          <ConfirmationButton
            disabled={mailing.state === MailingState.RUNNING} onClick={this.handleDelete}
            type={ButtonType.DANGER} typeYes={ButtonType.DANGER}>
            Удалить рассылку
          </ConfirmationButton>
        </div>
      </div>
    );
  }


  private handleDelete = () => {
    this.props.onDelete(this.props.mailing);
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

  private refresh = () => {
    if (this.props.onRefresh) {
      this.props.onRefresh(this.props.mailing);
    }
  }

  private renderStateButton () {
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
}
