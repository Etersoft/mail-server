import { combineReducers } from 'redux';
import { mailings, MailingListState } from './mailings';
import { ui, UiState } from './ui';
import { reducer as notifications } from 'react-notification-system-redux';
import { Notification } from 'react-notification-system';


export default combineReducers<RootState>({
  mailings,
  notifications,
  ui
});

export interface RootState {
  mailings: MailingListState;
  notifications: Notification[];
  ui: UiState;
}
