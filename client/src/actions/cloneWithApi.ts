import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { CreateResponse } from '../api';
import { Mailing } from '../reducers/mailings';
import { reloadMailingsData } from './reloadMailingsData';
import { selectMailing } from './selectMailing';


export function cloneWithApi (
  api: (id: number) => Promise<CreateResponse>,
  mailing: Mailing
) {
  return async function (dispatch: Dispatch<RootState>) {
    const { id } = await api(mailing.id);
    await dispatch(reloadMailingsData());
    await dispatch(selectMailing(id));
  };
}
