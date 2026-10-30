import * as React from 'react';
import * as parser from 'papaparse';
import { Receiver } from '../reducers/mailings';
import '../styles/ReceiverList';
import { ConfirmationButton } from './elements/ConfirmationButton';


export const MAX_RECEIVERS = 100;

export interface ReceiverListClickableButton {
  onClick: () => void;
  text: string;
}

export interface ReceiverListLinkButton {
  link: string;
  text: string;
}

export type ReceiverListButton = ReceiverListClickableButton | ReceiverListLinkButton;

export interface ReceiverListProps {
  buttons?: ReceiverListButton[];
  loading?: boolean;
  onChange?: (receivers: Receiver[]) => void;
  onRemove?: (receiver: Receiver) => void;
  receivers: Receiver[];
  receiversCount?: number;
  emptyText?: string;
  title?: string;
  unlimited?: boolean;
}

// Статус DSN: 5.x.x — постоянная ошибка (адреса нет, ящик закрыт),
// 4.x.x — временная (ящик переполнен, сервер недоступен)
function describeFailure (receiver: Receiver) {
  if (receiver.spam) {
    return 'отклонено как спам';
  }
  const kind = receiver.status && receiver.status.startsWith('5') ? 'постоянная ошибка' :
    receiver.status && receiver.status.startsWith('4') ? 'временная ошибка' : 'ошибка';
  return `${kind} ${receiver.status}`;
}

export class ReceiverList extends React.Component<ReceiverListProps> {
  static defaultProps = {
    emptyText: 'Список пуст',
    title: 'Получатели'
  };

  private fileInput: HTMLInputElement | null;

  render () {
    const receivers = this.props.unlimited ?
      this.props.receivers :
      this.props.receivers.slice(0, MAX_RECEIVERS);
    const length = this.props.receiversCount || this.props.receivers.length;

    const content = this.props.loading ? (
      <li className='overflow-item'>
        Загрузка…
      </li>
    ) : receivers.map((receiver, index) => {
      const removeButton = this.props.onRemove ? (
        <ConfirmationButton onClick={this.removeReceiver(receiver)}
                            label={'Удалить ' + receiver.email}>
          ✗
        </ConfirmationButton>
      ) : null;
      const details = [];
      if (receiver.name) {
        details.push(receiver.name);
      }
      if (receiver.periodicDate) {
        details.push('расписание: ' + receiver.periodicDate);
      }
      if (receiver.status || receiver.spam) {
        details.push(describeFailure(receiver));
      }
      if (receiver.excluded) {
        details.push('исключён из рассылки');
      }
      return (
        <li key={index}>
          <div className='receiver'>
            <span className='receiver-email'>{receiver.email}</span>
            {details.length ? (
              <span className='receiver-details'>{details.join(' · ')}</span>
            ) : null}
            {receiver.diagnosticCode ? (
              <span className='receiver-diagnostic'>{receiver.diagnosticCode}</span>
            ) : null}
          </div>
          {removeButton}
        </li>
      );
    });
    const empty = !this.props.loading && !receivers.length ? (
      <li className='overflow-item'>{this.props.emptyText}</li>
    ) : null;
    const overflow = (
      length > MAX_RECEIVERS && !this.props.unlimited && !this.props.loading
    ) ? (
      <li className='overflow-item'>
        ...и ещё {length - MAX_RECEIVERS} получателей
      </li>
    ) : null;
    return (
      <div className='receiver-list list-block with-border'>
        <h4 className='block-header'>
          {this.props.title} ({length})
          {this.renderActions()}
        </h4>
        <ul className='list'>
          {content}
          {empty}
          {overflow}
        </ul>
        <input type='file' onChange={this.changeFile}
               ref={el => this.fileInput = el} style={{ display: 'none' }}/>
      </div>
    );
  }

  private changeFile = async (event: React.FormEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files && event.currentTarget.files[0];
    if (file) {
      const receiversData: Array<[string]> = await this.readFile(file);
      const receivers: Receiver[] = receiversData
        .map(line => line.map(str => str.trim()).filter(str => str.length))
        .filter(line => line.length)
        .map(line => ({
          email: line[0],
          name: line[1] || '',
          extraData: JSON.parse(line[2] || '{}')
      }));
      if (this.props.onChange) {
        this.props.onChange(receivers);
      }
    }
  };

  private loadFromFile = () => {
    if (this.fileInput) {
      this.fileInput.value = '';
      this.fileInput.click();
    }
  };

  private readFile (file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      parser.parse(file, {
        complete: result => {
          resolve(result.data);
        },
        error: error => {
          reject(error);
        }
      });
    });
  }

  private removeReceiver (receiver: Receiver) {
    return () => {
      if (this.props.onRemove) {
        this.props.onRemove(receiver);
      }
    };
  }

  private renderActions () {
    const stdButtons = this.props.onChange ? (
      <React.Fragment>
        <button className='action' onClick={this.loadFromFile}>
          Из файла
        </button>
        <button className='action' onClick={this.reset}>
          Очистить
        </button>
      </React.Fragment>
    ) : null;

    const buttons = (this.props.buttons || []).map(button => {
      if ('onClick' in button) {
        return (
          <button className='action' key={button.text} onClick={button.onClick}>
            {button.text}
          </button>
        );
      } else {
        return (
          <a href={button.link} key={button.text}>
            <button className='action'>
              {button.text}
            </button>
          </a>
        );
      }
    });

    return (
      <div className='header-actions'>
        {stdButtons}
        {buttons}
      </div>
    );
  }

  private reset = () => {
    if (this.props.onChange) {
      this.props.onChange([]);
    }
  };

}
