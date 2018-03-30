import { RootState } from '../reducers/index';
import { Dispatch } from 'redux';
import { getReceivers as getReceiversFromServer } from '../api';
import { updateMailing } from './updateMailing';


export function loadReceivers (id: number) {
  return async function (dispatch: Dispatch<RootState>) {
    const receivers = await getReceiversFromServer(id);
    dispatch(updateMailing(id, {
      receivers
    }));
  };
}
