import * as React from 'react';
import '../../styles/RootView';
import { MailingListContainer } from './MailingListContainer';
import { RootState } from 'client/src/reducers';
import { connect, Dispatch } from 'react-redux';
import {
  MailingDetailViewContainer
} from './MailingDetailViewContainer';
import { Mailing } from 'client/src/reducers/mailings';
import { createMailing } from '../../actions/createMailing';
import { hideAddForm } from '../../actions/hideAddForm';
import { AddForm, MailingCreateData } from '../AddForm';
import { Animator } from '../Animator';
import * as Notifications from 'react-notification-system-redux';
import { Notification } from 'react-notification-system';


export interface RootViewProps {
  notifications: Notification[];
  onAdd: (mailing: MailingCreateData) => void;
  onHideAddForm: () => void;
  selectedMailing?: number;
  showAddForm: boolean;
}

class RootView extends React.Component<RootViewProps> {
  render () {
    const rightColumn = (typeof this.props.selectedMailing === 'number') ? (
      <div className='right-column'>
        <MailingDetailViewContainer />
      </div>
    ) : null;
    const rootStyle = {
      filter: this.props.showAddForm ? 'blur(4px)' : ''
    };
    return (
      <div className='root-view'>
        <div className='content' style={rootStyle}>
          <div className='left-column'>
            <MailingListContainer />
          </div>
          {rightColumn}
        </div>
        <Animator show={this.props.showAddForm}>
          <AddForm onAdd={this.props.onAdd} onClose={this.props.onHideAddForm} />
        </Animator>
        <Notifications notifications={this.props.notifications} />
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

function mapDispatchToProps (dispatch: Dispatch<RootState>) {
  return {
    onAdd: (data: MailingCreateData) => dispatch(createMailing(data)),
    onHideAddForm: () => dispatch(hideAddForm())
  };
}

export const RootViewContainer = connect(
  mapStateToProps, mapDispatchToProps
)(RootView as any);
