import { getMailingById, deleteReceiver } from '../api';
import { Dispatch } from 'redux';
import { RootState } from '../reducers';
import { notifyAboutError, notifySuccess } from './notify';
import { Mailing, Receiver } from '../reducers/mailings';
import { ActionTypes } from '../ActionTypes';
import { loadReceivers } from './loadReceivers';


export function removeReceiver (mailing: Mailing, receiver: Receiver) {
  return async function (dispatch: Dispatch<RootState>) {
    try {
      dispatch({
        data: {
          id: mailing.id,
          receiver
        },
        type: ActionTypes.REMOVE_RECEIVER
      });
      await deleteReceiver(mailing.id, receiver.email);
      dispatch(notifySuccess(`Получатель ${receiver.email} удалён из рассылки.`));
    } catch (error) {
      dispatch(notifyAboutError('Не удалось загрузить список рассылок.'));
    } finally {
      await dispatch(loadReceivers(mailing.id));
    }
  };
}
