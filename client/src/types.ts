import { ThunkDispatch } from 'redux-thunk';
import { ActionTypes } from './ActionTypes';
import type { RootState } from './reducers';


export interface Action {
  [name: string]: any;
  type: ActionTypes;
}

export type AppDispatch = ThunkDispatch<RootState, unknown, Action>;
