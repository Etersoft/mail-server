import { CreateResponse } from '../api';
import { Mailing } from '../reducers/mailings';
import { reloadMailingsData } from './reloadMailingsData';
import { selectMailing } from './selectMailing';
import { AppDispatch } from '../types';


export function cloneWithApi (
  api: (id: number) => Promise<CreateResponse>,
  mailing: Mailing
) {
  return async function (dispatch: AppDispatch) {
    const { id } = await api(mailing.id);
    await dispatch(reloadMailingsData());
    await dispatch(selectMailing(id));
  };
}
