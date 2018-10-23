import * as React from 'react';
import { ReceiverList } from './ReceiverList';
import { Mailing } from '../reducers/mailings';


export interface FailureListProps {
  mailing: Mailing;
  onReload: () => Promise<void> | void;
}

export class FailureList extends React.Component<FailureListProps> {
  componentDidMount () {
    if (!this.props.mailing.failedReceivers) {
      this.reload(false);
    }
  }

  componentDidUpdate (prevProps: FailureListProps) {
    if (prevProps.mailing.id !== this.props.mailing.id) {
      this.reload(false);
    }
  }

  render () {
    const { mailing } = this.props;
    const downloadButton = {
      link: API_URL + `/mailings/${mailing.id}/failed-receivers?format=csv`,
      text: 'Скачать'
    };
    const reloadFailuresButton = {
      onClick: this.reload,
      text: 'Обновить'
    };
    return (
      <ReceiverList receivers={mailing.failedReceivers || []}
                    receiversCount={mailing.failedReceiversCount}
                    loading={mailing.loadingFailedReceivers}
                    title='Ошибки доставки' buttons={[ reloadFailuresButton, downloadButton ]} />
    );
  }

  private reload = async (force: boolean = true) => {
    const { mailing } = this.props;
    if (!force && (mailing.failedReceivers || mailing.loadingFailedReceivers)) {
      return;
    }

    await this.props.onReload();
  }
}
