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
import { AddFormAnimator, MailingCreateData } from '../AddForm';


export interface RootViewProps {
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
        <AddFormAnimator show={this.props.showAddForm} onAdd={this.props.onAdd}
                         onClose={this.props.onHideAddForm} />
      </div>
    );
  }
}

function mapStateToProps (state: RootState) {
  return {
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
