import { getFailedReceivers } from '../api';
import { updateMailing } from './updateMailing';
import { AppDispatch } from '../types';


export function reloadFailedReceivers (id: number) {
  return async function (dispatch: AppDispatch) {
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
