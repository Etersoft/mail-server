import * as React from 'react';
import { Receiver } from '../reducers/mailings';
import '../styles/ReceiverList';


export const MAX_RECEIVERS = 10;

export interface ReceiverListProps {
  onChange?: (receivers: Receiver[]) => void;
  receivers: Receiver[];
  receiversCount?: number;
  title?: string;
  unlimited?: boolean;
}

export class ReceiverList extends React.Component<ReceiverListProps> {
  static defaultProps = {
    title: 'Получатели'
  };

  private fileInput: HTMLInputElement | null;

  render () {
    const receivers = this.props.unlimited ?
      this.props.receivers :
      this.props.receivers.slice(0, MAX_RECEIVERS);
    const length = this.props.receiversCount || this.props.receivers.length;
    const items = receivers.map((receiver, index) => {
      if (receiver.status) {
        return (
          <li key={index}>{receiver.email} (статус {receiver.status})</li>
        );
      }
      return (
        <li key={index}>{receiver.email}</li>
      );
    });
    const overflow = (length > MAX_RECEIVERS && !this.props.unlimited) ? (
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
          {items}
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
      const fileString = await this.readFile(file);
      const receivers: Receiver[] = fileString
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length)
        .map(email => ({
          email
        }));
      if (this.props.onChange) {
        this.props.onChange(receivers);
      }
    }
  }

  private loadFromFile = () => {
    if (this.fileInput) {
      this.fileInput.click();
    }
  }

  private readFile (file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  private renderActions () {
    if (!this.props.onChange) {
      return null;
    }

    return (
      <div className='header-actions'>
        <button className='action' onClick={this.loadFromFile}>
          Из файла
        </button>
        <button className='action' onClick={this.reset}>
          Очистить
        </button>
      </div>
    );
  }

  private reset = () => {
    if (this.props.onChange) {
      this.props.onChange([]);
    }
  }
}
