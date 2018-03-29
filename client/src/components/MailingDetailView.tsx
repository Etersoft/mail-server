import * as React from 'react';
import { Mailing } from '../reducers/mailings';
import '../styles/MailingDetailView';
import { MailingStateView } from './MailingStateView';


export interface MailingDetailViewProps {
  mailing: Mailing;
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
        </div>
      </div>
    );
  }
}
