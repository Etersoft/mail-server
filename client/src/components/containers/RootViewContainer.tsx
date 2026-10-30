import * as React from 'react';
import '../../styles/RootView';
import { MailingListContainer } from './MailingListContainer';
import { RootState } from '../../reducers';
import { connect } from 'react-redux';
import {
  MailingDetailViewContainer
} from './MailingDetailViewContainer';
import { createMailing } from '../../actions/createMailing';
import { hideAddForm } from '../../actions/hideAddForm';
import { AddForm, MailingCreateData } from '../AddForm';
import { Animator } from '../Animator';
import { Notifications } from '../Notifications';
import { SorterStatusView } from '../SorterStatusView';
import { NotificationItem } from '../../reducers/notifications';
import { hideNotification } from '../../actions/notify';
import { AppDispatch } from '../../types';
import { ActionTypes } from '../../ActionTypes';


export interface RootViewProps {
  notifications: NotificationItem[];
  onDismissNotification: (id: number) => void;
  onAdd: (mailing: MailingCreateData) => void;
  onHideAddForm: () => void;
  onShowList: () => void;
  selectedMailing?: number;
  showAddForm: boolean;
}

class RootView extends React.Component<RootViewProps> {
  render () {
    const selected = typeof this.props.selectedMailing === 'number';
    // На узком экране видна одна колонка: список или выбранная рассылка
    const rightColumn = selected ? (
      <div className='right-column'>
        <button className='back-to-list' onClick={this.props.onShowList}>
          ← Все рассылки
        </button>
        <MailingDetailViewContainer />
      </div>
    ) : (
      <div className='right-column no-selection'>
        <p>Выберите рассылку в списке или добавьте новую.</p>
      </div>
    );
    const rootStyle = {
      filter: this.props.showAddForm ? 'blur(4px)' : ''
    };
    return (
      <div className='root-view'>
        <div className={'content' + (selected ? ' has-selection' : '')} style={rootStyle}>
          <div className='left-column'>
            <MailingListContainer />
            <SorterStatusView />
          </div>
          {rightColumn}
        </div>
        <Animator show={this.props.showAddForm}>
          {nodeRef => (
            <AddForm containerRef={nodeRef} onAdd={this.props.onAdd}
                     onClose={this.props.onHideAddForm} />
          )}
        </Animator>
        <Notifications notifications={this.props.notifications}
                       onDismiss={this.props.onDismissNotification} />
      </div>
    );
  }
}

function mapStateToProps (state: RootState) {
  return {
    notifications: state.notifications,
    selectedMailing: state.mailings.selected,
    showAddForm: state.ui.showAddForm
  };
}

function mapDispatchToProps (dispatch: AppDispatch) {
  return {
    onAdd: (data: MailingCreateData) => dispatch(createMailing(data)),
    onDismissNotification: (id: number) => dispatch(hideNotification(id)),
    onHideAddForm: () => dispatch(hideAddForm()),
    onShowList: () => dispatch({ data: undefined, type: ActionTypes.SELECT_MAILING })
  };
}

export const RootViewContainer = connect(
  mapStateToProps, mapDispatchToProps
)(RootView as any);
