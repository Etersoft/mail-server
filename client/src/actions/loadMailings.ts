import { getMailings } from '../api';
import { ActionTypes } from '../ActionTypes';
import { Dispatch } from 'redux';
import { RootState } from 'client/src/reducers';


export function loadMailings () {
  return async function (dispatch: Dispatch<RootState>) {
    const mailings = await getMailings();
    dispatch({
      data: mailings,
      type: ActionTypes.SET_MAILINGS
    });
  };
}
