import { RootState } from '../reducers/index';
import { Dispatch } from 'redux';
import { getReceivers as getReceiversFromServer } from '../api';
import { updateMailing } from './updateMailing';
import { notifyAboutError } from './notify';


export function loadReceivers (id: number) {
  return async function (dispatch: Dispatch<RootState>) {
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
