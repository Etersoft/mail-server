import { Mailing } from '../reducers/mailings';
import { Dispatch } from 'react-redux';
import { RootState } from '../reducers/index';
import { ActionTypes } from '../ActionTypes';


export function selectMailing (mailing: Mailing) {
  return async function (dispatch: Dispatch<RootState>) {
    dispatch({
      data: mailing.id,
      type: ActionTypes.SELECT_MAILING
    });
  };
}
