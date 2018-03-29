import { ActionTypes } from '../ActionTypes';


export function notifyAboutError (text: string) {
  return {
    data: text,
    type: ActionTypes.SHOW_ERROR
  };
}
