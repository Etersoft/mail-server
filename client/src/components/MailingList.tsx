import * as React from 'react';
import { Mailing } from '../reducers/mailings';
import '../styles/List';
import { StateMarker } from './StateMarker';
import { Loading } from './elements/Loading';
import { mailingStateNames } from './MailingStateView';


export interface MailingListProps {
  loaded?: boolean;
  mailings: Mailing[];
  onShowAddForm?: () => void;
  onSelect?: (mailing: Mailing) => void;
  selectedMailing?: number;
}

export class MailingList extends React.Component<MailingListProps> {
  render () {
    // Новые сверху: обычно работают с последними рассылками
    const sorted = this.props.mailings.slice(0).sort((a, b) => b.id - a.id);
    const items = sorted.map(mailing => {
      const selected = mailing.id === this.props.selectedMailing;
      const onClick = (() => this.props.onSelect && this.props.onSelect(mailing));
      return (
        <li className={selected ? 'selected' : ''} key={mailing.id}>
          <button className='mailing-item' onClick={onClick} aria-current={selected}>
            <span className='mailing-name'>{mailing.name}</span>
            <span className='mailing-meta'>
              <StateMarker state={mailing.state} />
              {mailingStateNames[mailing.state]}
              {mailing.sentCount ? ` · отправлено ${mailing.sentCount}` : null}
              {mailing.locked ? <Loading> · загрузка</Loading> : null}
            </span>
          </button>
        </li>
      );
    });
    return (
      <div className='list-block mailing-list'>
        <h2 className='block-header'>
          Рассылки
          <div className='header-actions'>
            <button className='action' onClick={this.props.onShowAddForm}>
              Добавить
            </button>
          </div>
        </h2>
        {this.renderEmpty()}
        <ul className='list'>
          {items}
        </ul>
      </div>
    );
  }

  private renderEmpty () {
    if (this.props.mailings.length) {
      return null;
    }
    if (!this.props.loaded) {
      return <p className='list-empty'><Loading>Загрузка…</Loading></p>;
    }
    return (
      <p className='list-empty'>
        Рассылок пока нет. Нажмите «Добавить», чтобы создать первую: понадобится
        текст письма и список получателей в CSV.
      </p>
    );
  }
}
