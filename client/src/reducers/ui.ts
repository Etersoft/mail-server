import { Action } from '../types';
import { ActionTypes } from 'client/src/ActionTypes';


export interface UiState {
  showAddForm: boolean;
}

const initialState = {
  showAddForm: false
};


export function ui (state: UiState = initialState, action: Action): UiState {
  switch (action.type) {
    case ActionTypes.SHOW_ADD_FORM:
      return Object.assign({}, state, {
        showAddForm: true
      });
    case ActionTypes.HIDE_ADD_FORM:
      return Object.assign({}, state, {
        showAddForm: false
      });
    default:
      return state;
  }
}
