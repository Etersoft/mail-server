import * as React from 'react';
import { Mailing } from '../reducers/mailings';
import '../styles/List';


export interface MailingListProps {
  mailings: Mailing[];
  onShowAddForm?: () => void;
  onSelect?: (mailing: Mailing) => void;
  selectedMailing?: number;
}

export class MailingList extends React.Component<MailingListProps> {
  render () {
    const items = this.props.mailings.map(mailing => {
      const className = (mailing.id === this.props.selectedMailing) ? 'selected' : '';
      const onClick = (() => this.props.onSelect && this.props.onSelect(mailing));
      return (
        <li className={className} key={mailing.id} onClick={onClick}>{mailing.name}</li>
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
