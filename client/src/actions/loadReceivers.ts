import { getReceivers as getReceiversFromServer } from '../api';
import { updateMailing } from './updateMailing';
import { notifyAboutError } from './notify';
import { AppDispatch } from '../types';


export function loadReceivers (id: number) {
  return async function (dispatch: AppDispatch) {
    try {
      const { list, total } = await getReceiversFromServer(id);
      dispatch(updateMailing(id, {
        receivers: list,
        receiversCount: total
      }));
    } catch (error) {
      dispatch(notifyAboutError('Не удалось загрузить список рассылок.'));
    }
  };
}
