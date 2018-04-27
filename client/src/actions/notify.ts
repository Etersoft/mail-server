import { ActionTypes } from '../ActionTypes';
import { show } from 'react-notification-system-redux';
import { Dispatch } from 'redux';
import { RootState } from '../reducers';


export function notifyAboutError (text: string) {
  return async function (dispatch: Dispatch<RootState>) {
    dispatch(show({
      autoDismiss: 10,
      message: text,
      position: 'bc',
      title: 'Ошибка!'
    }, 'error'));
  };
}

export function notifySuccess (text: string) {
  return async function (dispatch: Dispatch<RootState>) {
    dispatch(show({
      autoDismiss: 3.5,
      message: text,
      position: 'bc'
    }, 'success'));
  };
}
