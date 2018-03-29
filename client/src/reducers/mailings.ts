import { MailingState } from 'server/src/Mailing';
import { Action } from '../types';
import { ActionTypes } from '../ActionTypes';
import { getMailings } from 'client/src/api';
import { MailingCreateData } from 'client/src/components/AddForm';


export interface MailingListState {
  byId: { [id: number]: Mailing };
  ids: number[];
  selected?: number;
}

export interface Mailing {
  id: number;
  name: string;
  receivers?: Receiver[];
  state: MailingState;
}

export interface Receiver {
  email: string;
}


function createMailing (data: MailingCreateData, id: number): Mailing {
  return {
    id,
    name: data.name,
    receivers: data.receivers,
    state: MailingState.NEW
  };
}

function createMailingListState (
  mailingsList: Mailing[], selected?: number
): MailingListState {
  const byId: any = {};
  for (const mailing of mailingsList) {
    byId[mailing.id] = mailing;
  }
  return {
    byId,
    ids: mailingsList.map(mailing => mailing.id),
    selected
  };
}

function getAllMailings (state: MailingListState): Mailing[] {
  return state.ids.map(id => state.byId[id]);
}

function updateMailing (
  state: MailingListState, mailingId: number, receivers: Receiver[]
): MailingListState {
  if (!state.byId[mailingId]) {
    return state;
  }

  const byId = Object.assign({}, state.byId, {
    [mailingId]: Object.assign({}, state.byId[mailingId], {
      receivers
    })
  });
  return {
    byId,
    ids: state.ids,
    selected: state.selected
  };
}

const initialState = createMailingListState([]);

export function mailings (state: MailingListState = initialState, action: Action) {
  switch (action.type) {
    case ActionTypes.SET_MAILINGS:
      return createMailingListState(action.data as Mailing[]);
    case ActionTypes.SET_MAILING_RECEIVERS:
      const { mailingId, receivers } = action.data;
      return updateMailing(state, mailingId, receivers);
    case ActionTypes.SELECT_MAILING:
      return Object.assign({}, state, {
        selected: action.data
      });
    case ActionTypes.ADD_MAILING:
      const mailingsList = getAllMailings(state);
      mailingsList.push(createMailing(action.data.mailing, action.data.id));
      return createMailingListState(mailingsList);
    default:
      return state;
  }
}
