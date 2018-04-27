import { MailingCreateData } from '../components/AddForm';
import { ActionTypes } from '../ActionTypes';


export function addMailing (mailing: MailingCreateData, id: number, listId: string) {
  return {
    data: { mailing, id, listId },
    type: ActionTypes.ADD_MAILING
  };
}
