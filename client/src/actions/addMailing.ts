import { MailingCreateData } from '../components/AddForm';
import { ActionTypes } from '../ActionTypes';


export function addMailing (mailing: MailingCreateData, id: number) {
  return {
    data: { mailing, id },
    type: ActionTypes.ADD_MAILING
  };
}
