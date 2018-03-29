import * as React from 'react';
import '../../styles/RootView';
import { MailingListContainer } from './MailingListContainer';
import { RootState } from 'client/src/reducers';
import { connect } from 'react-redux';
import {
  MailingDetailViewContainer
} from './MailingDetailViewContainer';


export interface RootViewProps {
  selectedMailing?: number;
}

class RootView extends React.Component<RootViewProps> {
  render () {
    const rightColumn = (typeof this.props.selectedMailing === 'number') ? (
      <div className='right-column'>
        <MailingDetailViewContainer />
      </div>
    ) : null;
    return (
      <div className='root-view'>
        <div className='left-column'>
          <MailingListContainer />
        </div>
        {rightColumn}
      </div>
    );
  }
}

function mapStateToProps (state: RootState) {
  return {
    selectedMailing: state.mailings.selected
  };
}

export const RootViewContainer = connect<RootViewProps>(
  mapStateToProps
)(RootView);
