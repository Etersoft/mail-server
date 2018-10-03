import * as React from 'react';
import { Receiver } from '../reducers/mailings';
import '../styles/AddForm';
import { ReceiverList } from './ReceiverList';
import { Editor } from './Editor';
// tslint:disable-next-line
const template = require('email-template.html');


export interface MailingCreateData {
  html: string;
  name: string;
  receivers: Receiver[];
  replyTo?: string;
  subject: string;
}

export interface AddFormProps {
  onAdd: (mailing: MailingCreateData) => void;
  onClose: () => void;
}

interface AddFormState {
  html: string;
  name: string;
  receivers: Receiver[];
  replyTo: string;
  subject: string;
}

export class AddForm extends React.Component<AddFormProps, AddFormState> {
  private editor: Editor | null;

  constructor (props: AddFormProps) {
    super(props);
    this.state = {
      html: template,
      name: '',
      receivers: [],
      replyTo: '',
      subject: ''
    };
  }

  render () {
    return (
      <div className='add-form-container'>
        <div className='add-form'>
          <h2 className='block-header'>
            Добавить рассылку
            <div className='header-actions'>
              <button className='action' disabled={!this.canAdd()} onClick={this.add}>
                Добавить
              </button>
              <button className='action' onClick={this.props.onClose}>
                Отмена
              </button>
            </div>
          </h2>
          <div className='form'>
            <div className='form-group'>
              <span className='input-name'>Название:</span>
              <input className='input' value={this.state.name} onChange={this.changeName} />
            </div>
            <div className='form-group'>
              <span className='input-name'>Тема письма:</span>
              <input className='input' value={this.state.subject} onChange={this.changeSubject} />
            </div>
            <div className='form-group'>
              <span className='input-name'>Обратный адрес (Reply-To):</span>
              <input className='input' value={this.state.replyTo} onChange={this.changeReplyTo} />
            </div>
            <div className='form-group stretch double'>
              <span className='input-name'>Текст рассылки:</span>
              <Editor ref={(editor: Editor) => this.editor = editor} html={this.state.html}
                      onChange={this.changeHtml} />
            </div>
            <div className='form-group stretch horizontal'>
              <ReceiverList onChange={this.changeReceivers} receivers={this.state.receivers} />
            </div>
          </div>
        </div>
        <div className='add-form-backdrop'>
        </div>
      </div>
    );
  }

  private add = () => {
    if (!this.editor) {
      return;
    }
    const mailing = {
      html: this.state.html,
      name: this.state.name,
      receivers: this.state.receivers,
      replyTo: this.state.replyTo || undefined,
      subject: this.state.subject
    };
    this.props.onAdd(mailing);
  }

  private canAdd () {
    return this.state.name.trim().length && this.state.receivers.length;
  }

  private changeHtml = (value: string) => {
    this.setState({
      html: value
    });
  }

  private changeName = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({
      name: event.currentTarget.value
    });
  }

  private changeSubject = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({
      subject: event.currentTarget.value
    });
  }

  private changeReceivers = (receivers: Receiver[]) => {
    this.setState({
      receivers
    });
  }

  private changeReplyTo = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({
      replyTo: event.currentTarget.value
    });
  }
}
