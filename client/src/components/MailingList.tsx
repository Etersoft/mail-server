import * as React from 'react';
import { Mailing } from '../reducers/mailings';
import '../styles/List';
import { StateMarker } from './StateMarker';
import { Loading } from './elements/Loading';


export interface MailingListProps {
  mailings: Mailing[];
  onShowAddForm?: () => void;
  onSelect?: (mailing: Mailing) => void;
  selectedMailing?: number;
}

export class MailingList extends React.Component<MailingListProps> {
  render () {
    const sorted = this.props.mailings.slice(0).sort((a, b) => {
      return a.id > b.id ? 1 : -1;
    });
    const items = sorted.map(mailing => {
      const className = (mailing.id === this.props.selectedMailing) ? 'selected' : '';
      const onClick = (() => this.props.onSelect && this.props.onSelect(mailing));
      const loadingMarker = mailing.locked ? (
        <Loading>(загрузка)</Loading>
      ) : null;
      return (
        <li className={className} key={mailing.id} onClick={onClick}>
          <StateMarker state={mailing.state} />
          {mailing.name}
          &nbsp;
          {loadingMarker}
        </li>
      );
    });
    return (
      <div className='list-block'>
        <h2 className='block-header'>
          Список рассылок
          <div className='header-actions'>
            <button className='action' onClick={this.props.onShowAddForm}>
              Добавить
            </button>
          </div>
        </h2>
        <ul className='list'>
          {items}
        </ul>
      </div>
    );
  }
}
