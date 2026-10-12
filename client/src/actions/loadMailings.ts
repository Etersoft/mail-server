import { getMailings } from '../api';
import { ActionTypes } from '../ActionTypes';
import { notifyAboutError } from './notify';
import { AppDispatch } from '../types';


export function loadMailings () {
  return async function (dispatch: AppDispatch) {
    try {
      const mailings = await getMailings();
      dispatch({
        data: mailings,
        type: ActionTypes.SET_MAILINGS
      });
    } catch (error) {
      dispatch(notifyAboutError('Не удалось загрузить список рассылок.'));
    }
  };
}
