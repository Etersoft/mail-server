import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { loadReceivers } from './loadReceivers';
import { getFailedReceivers } from '../api';
import { updateMailing } from './updateMailing';


export function reloadFailedReceivers (id: number) {
  return async function (dispatch: Dispatch<RootState>) {
    const { list, total } = await getFailedReceivers(id);
    dispatch(updateMailing(id, {
      failedReceivers: list,
      failedReceiversCount: total
    }));
  };
}
