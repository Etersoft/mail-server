import { getMailings } from '../api';
import { ActionTypes } from '../ActionTypes';
import { Dispatch } from 'redux';
import { RootState } from 'client/src/reducers';
import { notifyAboutError } from './notify';


export function loadMailings () {
  return async function (dispatch: Dispatch<RootState>) {
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
