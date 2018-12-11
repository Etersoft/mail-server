import * as React from 'react';
import { Mailing, Receiver } from '../reducers/mailings';
import '../styles/MailingDetailView';
import { MailingStateView } from './MailingStateView';
import { MailingState } from 'server/src/MailingState';
import { Button, ButtonType } from './elements/Button';
import { ConfirmationButton } from './elements/ConfirmationButton';
import { FormGroup } from './elements/FormGroup';
import { TextInput } from './elements/TextInput';
import pick from 'lodash-es/pick';
import { Editor } from './Editor';
import { ReceiverList } from './ReceiverList';
import { FailureList } from './FailureList';
import { Checkbox } from './elements/Checkbox';


const REFRESH_INTERVAL = 1000;

const editableFields = {
  html: 'Текст рассылки',
  name: 'Название',
  openForSubscription: 'Возможность подписки через API',
  receivers: 'Получатели',
  receiversChanged: '',
  receiversCount: 'Количество получателей',
  replyTo: 'Обратный адрес (Reply-To)',
  subject: 'Тема письма'
};
const keys = Object.keys(editableFields) as Array<keyof MailingEditData>;

export interface MailingEditData {
  html: string;
  name: string;
  openForSubscription: boolean;
  receivers: Receiver[];
  receiversCount: number;
  receiversChanged: boolean;
  replyTo: string;
  subject: string;
}

export interface MailingDetailViewProps {
  mailing: Mailing;
  onClone?: (mailing: Mailing) => void;
  onCreateRetry?: (mailing: Mailing) => void;
  onDelete: (mailing: Mailing) => void;
  onRefresh?: (mailing: Mailing) => void;
  onRefreshReceiversList?: (mailing: Mailing) => void;
  onRefreshFailedReceivers?: (mailing: Mailing) => Promise<void>;
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

  componentWillUnmount () {
    clearInterval(this.refreshInterval);
  }

  render () {
    const { mailing } = this.props;
    const firstButton = this.renderFirstButton();
    const spacer = firstButton ? <div className='spacer'>&nbsp;</div> : null;
    const retryButton = this.props.mailing.failedReceiversCount ? (
      <Button disabled={!this.canEdit()} onClick={this.handleCreateRetry}>
        Повтор рассылки по ошибочным адресам
      </Button>
    ) : null;
    const downloadButton = {
      link: API_URL + `/mailings/${mailing.id}/receivers?format=csv`,
      text: 'Скачать'
    };
    const refreshButton = {
      onClick: this.refreshReceiversList,
      text: 'Обновить'
    };
    const listTabs = [
      {
        content: (
          <ReceiverList receivers={this.state.fields.receivers}
                        receiversCount={this.state.fields.receiversCount}
                        buttons={[ downloadButton, refreshButton ]}
                        onChange={this.handlers.receivers} key='1' />
        ),
        name: 'Получатели'
      },
      {
        content: (
          <FailureList mailing={this.props.mailing} onReload={this.refreshFailedReceivers} />
        ),
        name: 'Ошибки доставки'
      }
    ];
    const creationDateInfo = mailing.creationDate ? (
      <React.Fragment>
        <h5 className='field-name'>Дата создания: </h5>
        <span className='field-value'>
          {mailing.creationDate.format('DD.MM.YYYY HH:mm:ss')}
        </span><br />
      </React.Fragment>
    ) : null;
    const replyTo = typeof this.state.fields.replyTo === 'string' ? this.state.fields.replyTo : '';
    return (
      <div className='mailing-detail-view'>
        <h2 className='header'>
          Рассылка: {mailing.name}
        </h2>
        <div className='details'>
          <h5 className='field-name'>List-Id: </h5>
          <span className='field-value'>{mailing.listId}</span><br />

          {creationDateInfo}

          <h5 className='field-name'>Состояние: </h5>
          <span className='field-value'><MailingStateView state={mailing.state} /></span><br />

          <h5 className='field-name'>Отправлено: </h5>
          <span className='field-value'>{mailing.sentCount}</span><br />

          <h5 className='field-name'>Количество ошибок доставки (DSN status 4.* или 5.*): </h5>
          <span className='field-value'>{mailing.undeliveredCount}</span><br />

          <h5 className='field-name'>Возможность подписки через API:</h5>
          <Checkbox
            value={this.state.fields.openForSubscription}
            onChange={this.handlers.openForSubscription}
          />
        </div>

        <div className='form'>
          <FormGroup inline title='Название:'>
            <TextInput value={this.state.fields.name} onChange={this.handlers.name} />
          </FormGroup>
          <FormGroup inline title='Тема письма:'>
            <TextInput value={this.state.fields.subject} onChange={this.handlers.subject} />
          </FormGroup>
          <FormGroup inline title='Обратный адрес (Reply-To):'>
            <TextInput value={replyTo} onChange={this.handlers.replyTo} />
          </FormGroup>
          <FormGroup stretch fraction={2}>
            <Editor onChange={this.handlers.html} html={this.state.fields.html}
                    additionalTabs={listTabs} />
          </FormGroup>
          <div className='button-group'>
            {firstButton}
            {spacer}
            <Button disabled={!this.canEdit()} onClick={this.handleClone}>
              Дублировать
            </Button>
            {retryButton}
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

  private getHandler (field: keyof MailingEditData) {
    if (field === 'receivers') {
      return (value: ReadonlyArray<Receiver>) => {
        this.setState({
          changed: true,
          fields: Object.assign({}, this.state.fields, {
            receivers: value,
            receiversChanged: true,
            receiversCount: value.length
          })
        });
      };
    }

    return (value: string) => {
      if (this.state.fields[field] !== value) {
        this.setState({
          changed: true,
          fields: Object.assign({}, this.state.fields, {
            [field]: value
          })
        });
      }
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

  private handleCreateRetry = () => {
    if (this.props.onCreateRetry) {
      this.props.onCreateRetry(this.props.mailing);
    }
  }

  private handleDelete = () => {
    this.props.onDelete(this.props.mailing);
  }

  private handleSave = () => {
    if (this.props.onUpdate) {
      this.props.onUpdate(this.props.mailing, this.state.fields);
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

  private refreshReceiversList = async () => {
    if (this.props.onRefreshReceiversList) {
      await this.props.onRefreshReceiversList(this.props.mailing);
      this.setState({
        fields: {
          ...this.state.fields,
          receivers: this.props.mailing.receivers!,
          receiversCount: this.props.mailing.receiversCount!
        }
      });
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
      return (
        <Button disabled={mailing.locked} onClick={this.handleStart}
                type={ButtonType.PRIMARY}>
          Перезапустить
        </Button>
      );
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
