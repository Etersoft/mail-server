import * as React from 'react';
import { Mailing, Receiver } from '../reducers/mailings';
import '../styles/MailingDetailView';
import { MailingStateView } from './MailingStateView';
import { MailingState } from '../../../server/src/MailingState';
import { Button, ButtonType } from './elements/Button';
import { ConfirmationButton } from './elements/ConfirmationButton';
import { FormGroup } from './elements/FormGroup';
import { TextInput } from './elements/TextInput';
import pick from 'lodash-es/pick';
import { Editor } from './Editor';
import { ReceiverList } from './ReceiverList';
import { FailureList } from './FailureList';
import { Checkbox } from './elements/Checkbox';
import { formatDate } from '../formatDate';


const REFRESH_INTERVAL = 1000;

const editableFields = {
  from: 'Отправитель (From)',
  html: 'Текст рассылки',
  listUnsubscribe: 'Кнопка «Отписаться» (List-Unsubscribe)',
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
  from: string;
  html: string;
  listUnsubscribe: boolean;
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
  onRemoveReceiver?: (mailing: Mailing, receiver: Receiver) => void;
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
    const canEdit = this.canEdit();
    const retryButton = mailing.failedReceiversCount ? (
      <Button disabled={!canEdit} onClick={this.handleCreateRetry}>
        Повторить для адресов с ошибками
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
    const count = (value?: number) => typeof value === 'number' ? ` (${value})` : '';
    const listTabs = [
      {
        content: (
          <ReceiverList receivers={this.state.fields.receivers}
                        receiversCount={this.state.fields.receiversCount}
                        onRemove={this.removeReceiver}
                        buttons={[ downloadButton, refreshButton ]}
                        onChange={this.handlers.receivers} key='1' />
        ),
        name: 'Получатели' + count(this.state.fields.receiversCount)
      },
      {
        content: (
          <FailureList mailing={mailing} onReload={this.refreshFailedReceivers} />
        ),
        name: 'Ошибки доставки' + count(mailing.failedReceiversCount)
      }
    ];
    const from = typeof this.state.fields.from === 'string' ? this.state.fields.from : '';
    const replyTo = typeof this.state.fields.replyTo === 'string' ? this.state.fields.replyTo : '';
    const id = (name: string) => `mailing-${mailing.id}-${name}`;
    return (
      <div className='mailing-detail-view'>
        <h2 className='header'>{mailing.name}</h2>
        <dl className='details'>
          <dt>Состояние</dt>
          <dd>
            <MailingStateView state={mailing.state} />
            {mailing.state === MailingState.PAUSED && mailing.autoResumeAt ?
              `, продолжится ${formatDate(new Date(mailing.autoResumeAt))}` : null}
          </dd>

          <dt>Отправлено писем</dt>
          <dd>{mailing.sentCount}</dd>

          <dt>Уведомлений о недоставке</dt>
          <dd>{mailing.undeliveredCount}</dd>

          {mailing.creationDate ? <dt>Создана</dt> : null}
          {mailing.creationDate ? <dd>{formatDate(mailing.creationDate)}</dd> : null}

          <dt>List-Id</dt>
          <dd className='technical'>{mailing.listId}</dd>
        </dl>

        <div className='options'>
          <Checkbox value={this.state.fields.listUnsubscribe}
                    onChange={this.handlers.listUnsubscribe}>
            Кнопка «Отписаться» в почтовых программах (заголовок List-Unsubscribe)
          </Checkbox>
          <Checkbox value={this.state.fields.openForSubscription}
                    onChange={this.handlers.openForSubscription}>
            Подписка через API открыта
          </Checkbox>
        </div>

        <div className='actions'>
          <div className='button-group'>
            {this.renderFirstButton()}
            {this.state.changed ? (
              <Button onClick={this.handleRevert}>Отменить изменения</Button>
            ) : null}
            <Button disabled={!canEdit} onClick={this.handleClone}>
              Дублировать
            </Button>
            {retryButton}
            <div className='spacer' />
            <ConfirmationButton
              disabled={!canEdit} onClick={this.handleDelete}
              type={ButtonType.DANGER} typeYes={ButtonType.DANGER}>
              Удалить рассылку
            </ConfirmationButton>
          </div>
          {mailing.state === MailingState.RUNNING ? (
            <p className='hint'>
              Пока рассылка выполняется, её нельзя менять: сначала приостановите её.
            </p>
          ) : null}
        </div>

        <div className='form'>
          <FormGroup inline title='Название' htmlFor={id('name')}>
            <TextInput id={id('name')} value={this.state.fields.name}
                       onChange={this.handlers.name} />
          </FormGroup>
          <FormGroup inline title='Тема письма' htmlFor={id('subject')}>
            <TextInput id={id('subject')} value={this.state.fields.subject}
                       onChange={this.handlers.subject} />
          </FormGroup>
          <FormGroup inline title='Отправитель (From)' htmlFor={id('from')}>
            <TextInput id={id('from')} value={from} onChange={this.handlers.from}
                       placeholder='по умолчанию — адрес сервиса' />
          </FormGroup>
          <FormGroup inline title='Ответы (Reply-To)' htmlFor={id('reply-to')}>
            <TextInput id={id('reply-to')} value={replyTo} onChange={this.handlers.replyTo}
                       placeholder='по умолчанию — на адрес отправителя' />
          </FormGroup>
          <FormGroup stretch fraction={2}>
            <Editor onChange={this.handlers.html} html={this.state.fields.html}
                    additionalTabs={listTabs} />
          </FormGroup>
        </div>

        <div className='test-email'>
          <FormGroup inline title='Пробное письмо на адрес' htmlFor={id('test-email')}>
            <div className='horizontal-group'>
              <TextInput id={id('test-email')} type='email' value={this.state.testEmail}
                         onChange={this.handleChangeTestEmail}
                         placeholder='например, свой адрес' />
              <Button disabled={!this.state.testEmail.length || !canEdit}
                      onClick={this.handleSendTestEmail}>
                Отправить
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
  };

  private handleClone = () => {
    if (this.props.onClone) {
      this.props.onClone(this.props.mailing);
    }
  };

  private handleCreateRetry = () => {
    if (this.props.onCreateRetry) {
      this.props.onCreateRetry(this.props.mailing);
    }
  };

  private handleDelete = () => {
    this.props.onDelete(this.props.mailing);
  };

  private handleRevert = () => {
    this.setState(initState(this.props.mailing));
  };

  private handleSave = () => {
    if (this.props.onUpdate) {
      this.props.onUpdate(this.props.mailing, this.state.fields);
      this.setState({
        changed: false
      });
    }
  };

  private handleSendTestEmail = () => {
    if (this.props.onSendTestEmail) {
      this.props.onSendTestEmail(this.props.mailing, this.state.testEmail);
    }
  };

  private handleStart = () => {
    if (this.props.onStart) {
      this.props.onStart(this.props.mailing);
    }
  };

  private handleStop = () => {
    if (this.props.onStop) {
      this.props.onStop(this.props.mailing);
    }
  };

  private refresh = () => {
    if (this.props.onRefresh) {
      this.props.onRefresh(this.props.mailing);
    }
  };

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
  };

  private refreshFailedReceivers = () => {
    if (this.props.onRefreshFailedReceivers) {
      this.props.onRefreshFailedReceivers(this.props.mailing);
    }
  };

  private removeReceiver = (receiver: Receiver) => {
    if (this.props.onRemoveReceiver) {
      this.props.onRemoveReceiver(this.props.mailing, receiver);
      this.setState({
        fields: {
          ...this.state.fields,
          receivers: this.state.fields.receivers.filter(r => r.email !== receiver.email),
          receiversCount: this.state.fields.receiversCount - 1
        }
      });
    }
  };

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
