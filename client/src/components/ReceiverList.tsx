import * as React from 'react';
import { Receiver } from '../reducers/mailings';
import '../styles/ReceiverList';


const MAX_RECEIVERS = 100;

export interface ReceiverListProps {
  onChange?: (receivers: Receiver[]) => void;
  receivers: Receiver[];
}

export class ReceiverList extends React.Component<ReceiverListProps> {
  private fileInput: HTMLInputElement | null;

  changeFile = async (event: React.FormEvent<HTMLInputElement>) => {
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

  loadFromFile = () => {
    if (this.fileInput) {
      this.fileInput.click();
    }
  }

  render () {
    const items = this.props.receivers.slice(0, MAX_RECEIVERS).map(receiver => {
      return (
        <li key={receiver.email}>{receiver.email}</li>
      );
    });
    const overflow = (this.props.receivers.length > MAX_RECEIVERS) ? (
      <li className='overflow-item'>
        ...и ещё {this.props.receivers.length - MAX_RECEIVERS} получателей
      </li>
    ) : null;
    return (
      <div className='list-block receiver-list'>
        <h4 className='block-header'>
          Список получателей ({this.props.receivers.length})
          <div className='header-actions'>
            <button className='action' onClick={this.loadFromFile}>
              Загрузить из файла
            </button>
          </div>
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

  private readFile (file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
}
