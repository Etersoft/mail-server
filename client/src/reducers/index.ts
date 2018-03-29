import { combineReducers } from 'redux';
import { mailings, MailingListState } from './mailings';


export default combineReducers<RootState>({
  mailings
});

export interface RootState {
  mailings: MailingListState;
}
