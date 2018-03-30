import * as React from 'react';
import { Mailing, Receiver } from '../reducers/mailings';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import '../styles/AddForm';
import { KeyboardEvent } from 'react';
import { ReceiverList } from './ReceiverList';
import { CKEditor } from './CKEditor';


export interface MailingCreateData {
  html: string;
  name: string;
  receivers: Receiver[];
  subject: string;
}

export interface AddFormProps {
  onAdd: (mailing: MailingCreateData) => void;
  onClose: () => void;
  show: boolean;
}

interface AddFormState {
  name: string;
  receivers: Receiver[];
  subject: string;
}

const ANIMATION_TIMEOUT = 350;

export class AddFormAnimator extends React.Component<AddFormProps> {
  render () {
    const transitionProps = {
      classNames: 'switch',
      timeout: ANIMATION_TIMEOUT
    };
    const content = this.props.show ? (
      <CSSTransition {...transitionProps}>
        {() => <AddForm {...this.props} />}
      </CSSTransition>
    ) : null;
    return (
      <TransitionGroup>
        {content}
      </TransitionGroup>
    );
  }
}

export class AddForm extends React.Component<AddFormProps, AddFormState> {
  private editor: CKEditor | null;

  constructor (props: AddFormProps) {
    super(props);
    this.state = {
      name: '',
      receivers: [],
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
            <div className='form-group stretch double'>
              <span className='input-name'>Текст рассылки:</span>
              <CKEditor ref={editor => this.editor = editor} />
            </div>
            <div className='form-group stretch'>
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
      html: this.editor.getContent(),
      name: this.state.name,
      receivers: this.state.receivers,
      subject: this.state.subject
    };
    this.props.onAdd(mailing);
  }

  private canAdd () {
    return this.state.name.trim().length && this.state.receivers.length;
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
}
