import { Action } from '../types';
import { ActionTypes } from '../ActionTypes';


export type NotificationLevel = 'error' | 'success';

export interface NotificationItem {
  id: number;
  level: NotificationLevel;
  message: string;
  title?: string;
}

export function notifications (
  state: NotificationItem[] = [], action: Action
): NotificationItem[] {
  switch (action.type) {
    case ActionTypes.SHOW_NOTIFICATION:
      return [...state, action.notification];
    case ActionTypes.HIDE_NOTIFICATION:
      return state.filter(item => item.id !== action.id);
    default:
      return state;
  }
}
