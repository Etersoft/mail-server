import { ActionTypes } from '../ActionTypes';


export function updateMailing (id: number, fields: any) {
  return {
    data: {
      fields, id
    },
    type: ActionTypes.UPDATE_MAILING
  };
}
