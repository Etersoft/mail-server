import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { MailingCreateData } from '../components/AddForm';
import { createMailing as createMailingOnServer } from '../api';
import { addMailing } from './addMailing';
import { hideAddForm } from './hideAddForm';
import { notifyAboutError, notifySuccess } from './notify';
import { ActionTypes } from '../ActionTypes';
import { Mailing } from '../reducers/mailings';
import { createMailing } from './createMailing';


export function cloneMailing (mailing: Mailing) {
  return async function (dispatch: Dispatch<RootState>) {
    try {
      if (!mailing.receivers  || !mailing.receivers.length) {
        dispatch(notifyAboutError('Нельзя создать рассылку без получателей.'));
        return;
      }
      const createData: MailingCreateData = {
        html: mailing.html,
        name: mailing.name + ' (копия)',
        receivers: mailing.receivers,
        replyTo: mailing.replyTo,
        subject: mailing.subject
      };
      const { id, listId } = await createMailingOnServer(createData);
      dispatch(addMailing(createData, id, listId));
      dispatch(hideAddForm());
      dispatch({
        data: id,
        type: ActionTypes.SELECT_MAILING
      });
      dispatch(notifySuccess('Рассылка дублирована успешно.'));
    } catch (error) {
      dispatch(notifyAboutError('Не удалось дублировать рассылку.'));
    }
  };
}
