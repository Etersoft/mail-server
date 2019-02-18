import * as React from 'react';
import { Mailing, Receiver } from '../../reducers/mailings';
import { MailingDetailView, MailingEditData } from '../MailingDetailView';
import { connect } from 'react-redux';
import { RootState } from '../../reducers';
import { Dispatch } from 'redux';
import { startMailing } from '../../actions/startMailing';
import { stopMailing } from '../../actions/stopMailing';
import { reloadSingleMailing } from '../../actions/reloadSingleMailing';
import { deleteMailing } from '../../actions/deleteMailing';
import { sendTestEmail } from '../../actions/sendTestEmail';
import { cloneMailing } from '../../actions/cloneMailing';
import { updateMailingOnServer } from '../../actions/updateMailingOnServer';
import { reloadFailedReceivers } from '../../actions/reloadFailedReceivers';
import { createRetryMailing } from '../../actions/createRetryMailing';
import { loadReceivers } from '../../actions/loadReceivers';
import { removeReceiver } from '../../actions/removeReceiver';


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
    onClone: (mailing: Mailing) => dispatch(cloneMailing(mailing)),
    onCreateRetry: (mailing: Mailing) => dispatch(createRetryMailing(mailing)),
    onDelete: (mailing: Mailing) => dispatch(deleteMailing(mailing.id)),
    onRefresh: (mailing: Mailing) => dispatch(reloadSingleMailing(mailing.id)),
    onRefreshFailedReceivers: (mailing: Mailing) => dispatch(
      reloadFailedReceivers(mailing.id)
    ),
    onRefreshReceiversList: (mailing: Mailing) => dispatch(
      loadReceivers(mailing.id)
    ),
    onRemoveReceiver: (mailing: Mailing, receiver: Receiver) => dispatch(
      removeReceiver(mailing, receiver)
    ),
    onSendTestEmail: (mailing: Mailing, email: string) => dispatch(
      sendTestEmail(mailing, email)
    ),
    onStart: (mailing: Mailing) => dispatch(startMailing(mailing.id)),
    onStop: (mailing: Mailing) => dispatch(stopMailing(mailing.id)),
    onUpdate: (mailing: Mailing, editData: MailingEditData) => dispatch(
      updateMailingOnServer(mailing, editData)
    )
  };
}

export const MailingDetailViewContainer = connect(
  mapStateToProps, mapDispatchToProps
)(MailingDetailView as any);
