import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { getFailedReceivers } from '../api';
import { updateMailing } from './updateMailing';


export function reloadFailedReceivers (id: number) {
  return async function (dispatch: Dispatch<RootState>) {
    try {
      dispatch(updateMailing(id, {
        loadingFailedReceivers: true
      }));
      const { list, total } = await getFailedReceivers(id);
      dispatch(updateMailing(id, {
        failedReceivers: list,
        failedReceiversCount: total
      }));
    } finally {
      dispatch(updateMailing(id, {
        loadingFailedReceivers: false
      }));
    }
  };
}
