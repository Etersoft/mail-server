import { ActionTypes } from '../ActionTypes';


export function lockMailing (id: number, locked: boolean) {
  return {
    data: {
      fields: { locked },
      id
    },
    type: ActionTypes.UPDATE_MAILING
  };
}
