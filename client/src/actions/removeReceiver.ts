import { deleteReceiver } from '../api';
import { notifyAboutError, notifySuccess } from './notify';
import { Mailing, Receiver } from '../reducers/mailings';
import { ActionTypes } from '../ActionTypes';
import { loadReceivers } from './loadReceivers';
import { AppDispatch } from '../types';


export function removeReceiver (mailing: Mailing, receiver: Receiver) {
  return async function (dispatch: AppDispatch) {
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
