import * as React from 'react';
import { Mailing } from '../../reducers/mailings';
import { MailingDetailView, MailingDetailViewProps } from '../MailingDetailView';
import { connect } from 'react-redux';
import { RootState } from 'client/src/reducers';


function mapStateToProps (state: RootState) {
  if (state.mailings.selected === undefined) {
    throw new Error('No selected mailing!');
  }
  return {
    mailing: state.mailings.byId[state.mailings.selected]
  };
}

export const MailingDetailViewContainer = connect<MailingDetailViewProps>(
  mapStateToProps
)(MailingDetailView);
