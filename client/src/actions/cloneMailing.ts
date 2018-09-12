import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { MailingCreateData } from '../components/AddForm';
import { cloneMailing as cloneMailingOnServer } from '../api';
import { addMailing } from './addMailing';
import { hideAddForm } from './hideAddForm';
import { notifyAboutError, notifySuccess } from './notify';
import { ActionTypes } from '../ActionTypes';
import { Mailing } from '../reducers/mailings';
import { createMailing } from './createMailing';
import { reloadMailingsData } from './reloadMailingsData';
import { selectMailing } from './selectMailing';


export function cloneMailing (mailing: Mailing) {
  return async function (dispatch: Dispatch<RootState>) {
    try {
      if (!mailing.receivers || !mailing.receivers.length) {
        dispatch(notifyAboutError('Нельзя создать рассылку без получателей.'));
        return;
      }
      const { id } = await cloneMailingOnServer(mailing.id);
      await dispatch(reloadMailingsData());
      await dispatch(selectMailing(id));
      dispatch(notifySuccess('Рассылка дублирована успешно.'));
    } catch (error) {
      dispatch(notifyAboutError('Не удалось дублировать рассылку.'));
    }
  };
}
