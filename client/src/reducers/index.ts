import { combineReducers } from 'redux';
import { mailings, MailingListState } from './mailings';
import { ui, UiState } from './ui';
import { notifications, NotificationItem } from './notifications';


export default combineReducers({
  mailings,
  notifications,
  ui
});

export interface RootState {
  mailings: MailingListState;
  notifications: NotificationItem[];
  ui: UiState;
}
