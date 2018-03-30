import * as React from 'react';
import { Mailing } from '../../reducers/mailings';
import { MailingDetailView, MailingDetailViewProps } from '../MailingDetailView';
import { connect } from 'react-redux';
import { RootState } from '../../reducers';
import { Dispatch } from 'redux';
import { startMailing } from '../../actions/startMailing';
import { stopMailing } from '../../actions/stopMailing';
import { reloadSingleMailing } from '../../actions/reloadSingleMailing';


function mapStateToProps (state: RootState) {
  if (state.mailings.selected === undefined) {
    throw new Error('No selected mailing!');
  }
  return {
    mailing: state.mailings.byId[state.mailings.selected]
  };
}

function mapDispatchToProps (dispatch: Dispatch<RootState>) {
  return {
    onRefresh: (mailing: Mailing) => dispatch(reloadSingleMailing(mailing.id)),
    onStart: (mailing: Mailing) => dispatch(startMailing(mailing.id)),
    onStop: (mailing: Mailing) => dispatch(stopMailing(mailing.id))
  };
}

export const MailingDetailViewContainer = connect<MailingDetailViewProps>(
  mapStateToProps, mapDispatchToProps
)(MailingDetailView);
