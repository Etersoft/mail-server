import { cloneMailing as cloneMailingOnServer } from '../api';
import { notifyAboutError, notifySuccess } from './notify';
import { Mailing } from '../reducers/mailings';
import { cloneWithApi } from './cloneWithApi';
import { AppDispatch } from '../types';


export function cloneMailing (mailing: Mailing) {
  return async function (dispatch: AppDispatch) {
    try {
      if (!mailing.receivers || !mailing.receivers.length) {
        dispatch(notifyAboutError('Нельзя создать рассылку без получателей.'));
        return;
      }
      await dispatch(cloneWithApi(cloneMailingOnServer, mailing));
      dispatch(notifySuccess('Рассылка дублирована успешно.'));
    } catch (error) {
      dispatch(notifyAboutError('Не удалось дублировать рассылку.'));
    }
  };
}
