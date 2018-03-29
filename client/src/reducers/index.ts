import { combineReducers } from 'redux';
import { mailings, MailingListState } from './mailings';
import { ui, UiState } from './ui';


export default combineReducers<RootState>({
  mailings,
  ui
});

export interface RootState {
  mailings: MailingListState;
  ui: UiState;
}
