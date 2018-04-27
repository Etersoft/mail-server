import { Mailing } from '../reducers/mailings';
import { Dispatch } from 'react-redux';
import { RootState } from '../reducers/index';
import { ActionTypes } from '../ActionTypes';
import { loadReceivers } from './loadReceivers';
import { sendTestEmail as sendTestEmailApi } from '../api';


export function sendTestEmail (mailing: Mailing, email: string) {
  return async function (dispatch: Dispatch<RootState>) {
    await sendTestEmailApi(mailing.id, email);
    alert('Отправлено');
  };
}
