import * as React from 'react';
import { Mailing, Receiver } from '../reducers/mailings';
import '../styles/MailingDetailView';
import { MailingStateView } from './MailingStateView';
import { MailingState, Headers } from 'server/src/Mailing';
import { Button, ButtonType } from './elements/Button';
import { ConfirmationButton } from './elements/ConfirmationButton';
import { FormGroup } from './elements/FormGroup';
import { TextInput } from './elements/TextInput';
import pick from 'lodash-es/pick';
import { HeaderEditor } from './HeaderEditor';
import { Editor } from './Editor';
import { ReceiverList } from './ReceiverList';


const REFRESH_INTERVAL = 1000;

const editableFields = {
  headers: 'Заголовки',
  html: 'Текст рассылки',
  name: 'Название',
  receivers: 'Получатели',
  replyTo: 'Обратный адрес (Reply-To)',
  subject: 'Тема письма'
};
const keys = Object.keys(editableFields);

export interface MailingEditData {
  headers: Headers;
  html: string;
  name: string;
  receivers: Receiver[];
  replyTo: string;
  subject: string;
}

export interface MailingDetailViewProps {
  mailing: Mailing;
  onClone?: (mailing: Mailing) => void;
  onDelete: (mailing: Mailing) => void;
  onRefresh?: (mailing: Mailing) => void;
  onSendTestEmail?: (mailing: Mailing, address: string) => void;
  onStart?: (mailing: Mailing) => void;
  onStop?: (mailing: Mailing) => void;
  onUpdate?: (mailing: Mailing, saveData: MailingEditData) => void;
}

interface MailingDetailViewState {
  changed: boolean;
  fields: MailingEditData;
  mailingId: number;
  testEmail: string;
}

function initState (mailing: Mailing) {
  return {
    changed: false,
    fields: pick(mailing, keys) as MailingEditData,
    mailingId: mailing.id,
    testEmail: ''
  };
}

export class MailingDetailView extends React.Component<
  MailingDetailViewProps, MailingDetailViewState
> {
  public static getDerivedStateFromProps (
    nextProps: MailingDetailViewProps, prevState: MailingDetailViewState
  ) {
    if (nextProps.mailing.id !== prevState.mailingId) {
      return initState(nextProps.mailing);
    }

    return null;
  }

  private editor: Editor | null;
  private handlers: { [name: string]: (value: any) => void };
  private refreshInterval: number;

  constructor (props: MailingDetailViewProps) {
    super(props);
    this.state = initState(props.mailing);
    this.handlers = {};
    for (const key of keys) {
      this.handlers[key] = this.getHandler(key);
    }
  }

  componentDidMount () {
    this.refreshInterval = setInterval(this.refresh, REFRESH_INTERVAL) as any;
  }

  componentDidUpdate (prevProps: MailingDetailViewProps) {
    if (prevProps.mailing.id !== this.props.mailing.id && this.editor) {
      this.editor.reset(this.props.mailing.html);
    }
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
          <h5 className='field-name'>List-Id: </h5>
          <span className='field-value'>{mailing.listId}</span><br />

          <h5 className='field-name'>Состояние: </h5>
          <span className='field-value'><MailingStateView state={mailing.state} /></span><br />

          <h5 className='field-name'>Отправлено: </h5>
          <span className='field-value'>{mailing.sentCount}</span><br />

          <h5 className='field-name'>Количество ошибок доставки (DSN status 4.* или 5.*): </h5>
          <span className='field-value'>{mailing.undeliveredCount}</span><br />
        </div>

        <div className='form'>
          <FormGroup inline title='Название:'>
            <TextInput value={this.state.fields.name} onChange={this.handlers.name} />
          </FormGroup>
          <FormGroup inline title='Тема письма:'>
            <TextInput value={this.state.fields.subject} onChange={this.handlers.subject} />
          </FormGroup>
          <FormGroup inline title='Обратный адрес (Reply-To):'>
            <TextInput value={this.state.fields.replyTo} onChange={this.handlers.replyTo} />
          </FormGroup>
          <FormGroup stretch fraction={2}>
            <Editor html={this.state.fields.html} ref={(e: Editor) => this.editor = e} />
          </FormGroup>
          <FormGroup stretch>
            <ReceiverList receivers={this.state.fields.receivers}
                          onChange={this.handlers.receivers} />
          </FormGroup>
          <div className='button-group'>
            {this.renderStateButton()}
            <ConfirmationButton
              disabled={mailing.state === MailingState.RUNNING} onClick={this.handleDelete}
              type={ButtonType.DANGER} typeYes={ButtonType.DANGER}>
              Удалить
            </ConfirmationButton>
            <Button onClick={this.handleClone}>
              Дублировать
            </Button>
            <Button onClick={this.handleSave}>
              Сохранить изменения
            </Button>
          </div>
        </div>

        <div className='test-email'>
          <FormGroup>
            <div className='horizontal-group'>
              <TextInput value={this.state.testEmail} onChange={this.handleChangeTestEmail}
                         placeholder='Адрес...' />
              <Button disabled={!this.state.testEmail.length} onClick={this.handleSendTestEmail}>
                Отправить пробное письмо
              </Button>
            </div>
          </FormGroup>
        </div>
      </div>
    );
  }


  private getHandler (field: string) {
    return (value: string) => {
      this.setState({
        changed: true,
        fields: Object.assign({}, this.state.fields, {
          [field]: value
        })
      });
    };
  }

  private handleChangeTestEmail = (value: string) => {
    this.setState({
      testEmail: value
    });
  }

  private handleClone = () => {
    if (this.props.onClone) {
      this.props.onClone(this.props.mailing);
    }
  }

  private handleDelete = () => {
    this.props.onDelete(this.props.mailing);
  }

  private handleSave = () => {
    if (this.props.onUpdate && this.editor) {
      const saveData = Object.assign({}, this.state.fields, {
        html: this.editor.getContent()
      });
      this.props.onUpdate(this.props.mailing, saveData);
    }
  }

  private handleSendTestEmail = () => {
    if (this.props.onSendTestEmail) {
      this.props.onSendTestEmail(this.props.mailing, this.state.testEmail);
    }
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
          Приостановить
        </Button>
      );
    } else {
      return (
        <Button disabled={mailing.locked} onClick={this.handleStart}>
          Запустить
        </Button>
      );
    }
  }
}
