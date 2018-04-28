import { Mailing } from '../reducers/mailings';
import { Dispatch } from 'react-redux';
import { RootState } from '../reducers/index';
import { ActionTypes } from '../ActionTypes';
import { loadReceivers } from './loadReceivers';
import { getMailingById } from '../api';
import { updateMailing } from './updateMailing';
import { reloadFailedReceivers } from './reloadFailedReceivers';


export function loadFullMailingData (id: number) {
  return async function (dispatch: Dispatch<RootState>) {
    const mailing = await getMailingById(id);
    dispatch(updateMailing(id, mailing));
    await dispatch(loadReceivers(mailing.id));
    await dispatch(reloadFailedReceivers(mailing.id));
  };
}
