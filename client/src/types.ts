import { ActionTypes } from './ActionTypes';


export interface Action {
  [name: string]: any;
  type: ActionTypes;
}
