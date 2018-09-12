import * as React from 'react';
import { Mailing, Receiver } from '../reducers/mailings';
import '../styles/MailingDetailView';
import { MailingStateView } from './MailingStateView';
import { MailingState } from 'server/src/Mailing';
import { Button, ButtonType } from './elements/Button';
import { ConfirmationButton } from './elements/ConfirmationButton';
import { FormGroup } from './elements/FormGroup';
import { TextInput } from './elements/TextInput';
import pick from 'lodash-es/pick';
import { Editor } from './Editor';
import { ReceiverList } from './ReceiverList';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';


const REFRESH_INTERVAL = 1000;
const FAILED_RECEIVERS_REFRESH_INTERVAL = 30000;

const editableFields = {
  html: 'Текст рассылки',
  name: 'Название',
  receivers: 'Получатели',
  receiversCount: 'Количество получателей',
  replyTo: 'Обратный адрес (Reply-To)',
  subject: 'Тема письма'
};
const keys = Object.keys(editableFields);

export interface MailingEditData {
  html: string;
  name: string;
  receivers: Receiver[];
  receiversCount: number;
  replyTo: string;
  subject: string;
}

export interface MailingDetailViewProps {
  mailing: Mailing;
  onClone?: (mailing: Mailing) => void;
  onDelete: (mailing: Mailing) => void;
  onRefresh?: (mailing: Mailing) => void;
  onRefreshFailedReceivers?: (mailing: Mailing) => void;
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
  private failedReceiversRefreshInterval: number;
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
    this.failedReceiversRefreshInterval = setInterval(
      this.refreshFailedReceivers, FAILED_RECEIVERS_REFRESH_INTERVAL
    ) as any;
  }

  componentDidUpdate (prevProps: MailingDetailViewProps) {
    if (prevProps.mailing.id !== this.props.mailing.id && this.editor) {
      this.editor.reset(this.props.mailing.html);
      this.setState({
        changed: false
      });
    }
  }

  componentWillUnmount () {
    clearInterval(this.refreshInterval);
  }

  render () {
    const { mailing } = this.props;
    const receivers = mailing.receivers ? mailing.receivers.length : '(загрузка)';
    const firstButton = this.renderFirstButton();
    const spacer = firstButton ? <div className='spacer'>&nbsp;</div> : null;
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
            <Editor onChange={this.handleHtmlChange} html={this.state.fields.html}
                    ref={(e: Editor) => this.editor = e} />
          </FormGroup>
          <FormGroup stretch horizontal>
            <Tabs>
              <TabList>
                <Tab>Получатели</Tab>
                <Tab>Ошибки доставки</Tab>
              </TabList>
              <TabPanel>
                <ReceiverList receivers={this.state.fields.receivers}
                              receiversCount={this.state.fields.receiversCount}
                              onChange={this.handlers.receivers} />
              </TabPanel>
              <TabPanel>
                <ReceiverList receivers={this.props.mailing.failedReceivers || []}
                              receiversCount={this.props.mailing.failedReceiversCount}
                              title='Ошибки доставки' />
              </TabPanel>
            </Tabs>
          </FormGroup>
          <div className='button-group'>
            {firstButton}
            {spacer}
            <Button disabled={!this.canEdit()} onClick={this.handleClone}>
              Дублировать
            </Button>
            <ConfirmationButton
              disabled={!this.canEdit()} onClick={this.handleDelete}
              type={ButtonType.DANGER} typeYes={ButtonType.DANGER}>
              Удалить
            </ConfirmationButton>
          </div>
        </div>

        <div className='test-email'>
          <FormGroup>
            <div className='horizontal-group'>
              <TextInput value={this.state.testEmail} onChange={this.handleChangeTestEmail}
                         placeholder='Адрес...' />
              <Button disabled={!this.state.testEmail.length || !this.canEdit()}
                      onClick={this.handleSendTestEmail}>
                Отправить пробное письмо
              </Button>
            </div>
          </FormGroup>
        </div>
      </div>
    );
  }


  private canEdit () {
    return !this.props.mailing.locked && this.props.mailing.state !== MailingState.RUNNING;
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

  private handleHtmlChange = () => {
    this.setState({
      changed: true
    });
  }

  private handleSave = () => {
    if (this.props.onUpdate && this.editor) {
      const saveData = Object.assign({}, this.state.fields, {
        html: this.editor.getContent()
      });
      this.props.onUpdate(this.props.mailing, saveData);
      this.setState({
        changed: false
      });
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

  private refreshFailedReceivers = () => {
    if (this.props.onRefreshFailedReceivers) {
      this.props.onRefreshFailedReceivers(this.props.mailing);
    }
  }

  private renderFirstButton () {
    if (this.state.changed) {
      return (
        <Button disabled={!this.canEdit()} onClick={this.handleSave}
                type={ButtonType.PRIMARY}>
          Сохранить изменения
        </Button>
      );
    } else {
      return this.renderStateButton();
    }
  }

  private renderStateButton () {
    const { mailing } = this.props;
    if (mailing.state === MailingState.FINISHED) {
      return null;
    } else if (mailing.state === MailingState.RUNNING) {
      return (
        <Button disabled={mailing.locked} onClick={this.handleStop}
                type={ButtonType.PRIMARY}>
          Приостановить
        </Button>
      );
    } else {
      return (
        <Button disabled={mailing.locked || this.state.changed}
                onClick={this.handleStart} type={ButtonType.PRIMARY}>
          Запустить
        </Button>
      );
    }
  }
}
