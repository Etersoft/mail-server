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
  title?: string;
  unlimited?: boolean;
}

interface ReceiverListState {
  selected?: string;
}

export class ReceiverList extends React.Component<ReceiverListProps, ReceiverListState> {
  static defaultProps = {
    title: 'Получатели'
  };

  public state: ReceiverListState = {};
  private fileInput: HTMLInputElement | null;

  render () {
    const receivers = this.props.unlimited ?
      this.props.receivers :
      this.props.receivers.slice(0, MAX_RECEIVERS);
    const length = this.props.receiversCount || this.props.receivers.length;

    const content = this.props.loading ? (
      <li className='overflow-item'>
        (загрузка)
      </li>
    ) : receivers.map((receiver, index) => {
      let receiverInfo = receiver.email;
      if (receiver.name) {
        receiverInfo += ', имя: ' + receiver.name;
      }
      if (receiver.periodicDate) {
        receiverInfo += ', расписание рассылки: ' + receiver.periodicDate;
      }
      const removeButton = this.props.onRemove ? (
        <React.Fragment>
          <div className='spacer' />
          <ConfirmationButton onClick={this.removeReceiver(receiver)}>
            ✗
          </ConfirmationButton>
        </React.Fragment>
      ) : null;
      if (this.state.selected === receiver.email) {
        return <li key={index} className='selected'>
          <b>{receiverInfo}</b>: {receiver.diagnosticCode}
          {removeButton}
        </li>;
      } else if (receiver.status) {
        const comment = receiver.spam ? 'отвергнуто как спам' : `статус ${receiver.status}`;
        return (
          <li key={index} onClick={this.showDetails(receiver.email)}>
            {receiverInfo} ({comment}) {removeButton}
          </li>
        );
      }
      return (
        <li key={index}>{receiverInfo} {removeButton}</li>
      );
    });
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
          extraData: JSON.parse(line[2] || "{}")
      }));
      if (this.props.onChange) {
        this.props.onChange(receivers);
      }
    }
  }

  private loadFromFile = () => {
    if (this.fileInput) {
      this.fileInput.value = '';
      this.fileInput.click();
    }
  }

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
  }

  private showDetails = (email: string) => {
    return () => {
      this.setState({
        selected: email
      });
    };
  }
}
