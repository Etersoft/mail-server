import { ActionTypes } from '../ActionTypes';
import { NotificationItem, NotificationLevel } from '../reducers/notifications';
import { AppDispatch } from '../types';


let lastId = 0;

export function hideNotification (id: number) {
  return { id, type: ActionTypes.HIDE_NOTIFICATION };
}

function show (level: NotificationLevel, message: string, autoDismiss: number, title?: string) {
  return async function (dispatch: AppDispatch) {
    const notification: NotificationItem = { id: ++lastId, level, message, title };
    dispatch({ notification, type: ActionTypes.SHOW_NOTIFICATION });
    setTimeout(() => dispatch(hideNotification(notification.id)), autoDismiss * 1000);
  };
}

export function notifyAboutError (text: string) {
  return show('error', text, 10, 'Ошибка!');
}

export function notifySuccess (text: string) {
  return show('success', text, 3.5);
}
