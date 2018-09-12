import { MailingState } from 'server/src/Mailing';
import { Action } from '../types';
import { ActionTypes } from '../ActionTypes';
import { MailingCreateData } from '../components/AddForm';


export interface MailingListState {
  byId: { [id: number]: Mailing };
  ids: number[];
  selected?: number;
}

export interface Mailing {
  failedReceivers?: Receiver[];
  failedReceiversCount?: number;
  html: string;
  id: number;
  listId: string;
  locked: boolean;
  name: string;
  receivers?: Receiver[];
  receiversCount?: number;
  replyTo?: string;
  sentCount: number;
  state: MailingState;
  subject: string;
  undeliveredCount: number;
}

export interface Receiver {
  email: string;
  status?: string;
}


function createMailing (data: MailingCreateData, id: number, listId: string): Mailing {
  return {
    html: data.html,
    id,
    listId,
    locked: false,
    name: data.name,
    receivers: data.receivers,
    replyTo: data.replyTo,
    sentCount: 0,
    state: MailingState.NEW,
    subject: data.subject,
    undeliveredCount: 0
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

function deleteMailing (state: MailingListState, idToDelete: number) {
  const selected = (idToDelete === state.selected) ? undefined : state.selected;
  const objects = state.ids.filter(id => id !== idToDelete).map(id => state.byId[id]);
  return createMailingListState(objects, selected);
}

function getAllMailings (state: MailingListState): Mailing[] {
  return state.ids.map(id => state.byId[id]);
}

function updateMailing (
  state: MailingListState, mailingId: number, fields: any
): MailingListState {
  if (!state.byId[mailingId]) {
    return state;
  }

  const byId = Object.assign({}, state.byId, {
    [mailingId]: Object.assign({}, state.byId[mailingId], fields)
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
    case ActionTypes.DELETE_MAILING:
      return deleteMailing(state, action.data);
    case ActionTypes.SELECT_MAILING:
      return Object.assign({}, state, {
        selected: action.data
      });
    case ActionTypes.ADD_MAILING:
      const mailingsList = getAllMailings(state);
      mailingsList.push(createMailing(
        action.data.mailing, action.data.id, action.data.listId
      ));
      return createMailingListState(mailingsList);
    case ActionTypes.UPDATE_MAILING:
      return updateMailing(state, action.data.id, action.data.fields);
    default:
      return state;
  }
}
