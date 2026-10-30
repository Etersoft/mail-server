import * as React from 'react';
import { Receiver } from '../reducers/mailings';
import '../styles/AddForm';
import { ReceiverList } from './ReceiverList';
import { Editor } from './Editor';
import template from '../email-template.html';


const RECEIVERS_HELP = 'Загрузите CSV-файл кнопкой «Из файла»: в каждой строке адрес, ' +
  'имя и, если нужно, дополнительные данные в JSON — они доступны в шаблоне письма.';

export interface MailingCreateData {
  from?: string;
  html: string;
  name: string;
  receivers: Receiver[];
  replyTo?: string;
  subject: string;
}

export interface AddFormProps {
  containerRef?: React.Ref<HTMLDivElement>;
  onAdd: (mailing: MailingCreateData) => void;
  onClose: () => void;
}

interface AddFormState {
  from: string;
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
      from: '',
      html: template,
      name: '',
      receivers: [],
      replyTo: '',
      subject: ''
    };
  }

  render () {
    return (
      <div className='add-form-container' ref={this.props.containerRef}
           onKeyDown={this.handleKeyDown}>
        <div className='add-form' role='dialog' aria-modal='true'
             aria-labelledby='add-form-title'>
          <h2 className='block-header' id='add-form-title'>
            Новая рассылка
            <div className='header-actions'>
              <button className='action' disabled={!this.canAdd()} onClick={this.add}>
                Добавить
              </button>
              <button className='action' onClick={this.props.onClose}>
                Отмена
              </button>
            </div>
          </h2>
          {this.missing() ? <p className='add-hint'>{this.missing()}</p> : null}
          <div className='form'>
            <div className='form-group'>
              <label className='input-name' htmlFor='add-name'>Название</label>
              <input className='input' id='add-name' value={this.state.name}
                     onChange={this.changeName} autoFocus />
            </div>
            <div className='form-group'>
              <label className='input-name' htmlFor='add-subject'>Тема письма</label>
              <input className='input' id='add-subject' value={this.state.subject}
                     onChange={this.changeSubject} />
            </div>
            <div className='form-group'>
              <label className='input-name' htmlFor='add-from'>Отправитель (From)</label>
              <input className='input' id='add-from' value={this.state.from}
                     onChange={this.changeFrom}
                     placeholder='по умолчанию — адрес сервиса' />
            </div>
            <div className='form-group'>
              <label className='input-name' htmlFor='add-reply-to'>Ответы (Reply-To)</label>
              <input className='input' id='add-reply-to' value={this.state.replyTo}
                     onChange={this.changeReplyTo}
                     placeholder='по умолчанию — на адрес отправителя' />
            </div>
            <div className='form-group stretch double'>
              <span className='input-name'>Текст письма</span>
              <Editor ref={(editor: Editor) => this.editor = editor} html={this.state.html}
                      onChange={this.changeHtml} />
            </div>
            <div className='form-group stretch horizontal'>
              <ReceiverList onChange={this.changeReceivers} receivers={this.state.receivers}
                            emptyText={RECEIVERS_HELP} />
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
      from: this.state.from || undefined,
      html: this.state.html,
      name: this.state.name,
      receivers: this.state.receivers,
      replyTo: this.state.replyTo || undefined,
      subject: this.state.subject
    };
    this.props.onAdd(mailing);
  };

  private handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.props.onClose();
    }
  };

  // Чего не хватает, чтобы создать рассылку
  private missing () {
    if (!this.state.name.trim().length) {
      return 'Чтобы создать рассылку, укажите название и загрузите получателей';
    }
    if (!this.state.receivers.length) {
      return 'Чтобы создать рассылку, загрузите получателей';
    }
    return '';
  }

  private canAdd () {
    return this.state.name.trim().length && this.state.receivers.length;
  }

  private changeFrom = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({
      from: event.currentTarget.value
    });
  };

  private changeHtml = (value: string) => {
    this.setState({
      html: value
    });
  };

  private changeName = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({
      name: event.currentTarget.value
    });
  };

  private changeSubject = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({
      subject: event.currentTarget.value
    });
  };

  private changeReceivers = (receivers: Receiver[]) => {
    this.setState({
      receivers
    });
  };

  private changeReplyTo = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({
      replyTo: event.currentTarget.value
    });
  };
}
