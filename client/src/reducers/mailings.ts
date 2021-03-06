import { MailingState } from 'server/src/MailingState';
import { Action } from '../types';
import { ActionTypes } from '../ActionTypes';
import { MailingCreateData } from '../components/AddForm';
import * as moment from 'moment';


export interface MailingListState {
  byId: { [id: number]: Mailing };
  ids: number[];
  selected?: number;
}

export interface Mailing {
  creationDate?: moment.Moment;
  failedReceivers?: Receiver[];
  failedReceiversCount?: number;
  html: string;
  id: number;
  listId: string;
  loadingFailedReceivers: boolean;
  locked: boolean;
  name: string;
  openForSubscription: boolean;
  receivers?: Receiver[];
  receiversChanged: boolean;
  receiversCount?: number;
  replyTo?: string;
  sentCount: number;
  state: MailingState;
  subject: string;
  undeliveredCount: number;
}

export interface Receiver {
  diagnosticCode?: string;
  email: string;
  name?: string;
  periodicDate?: string | number;
  spam?: boolean;
  status?: string;
  extraData?: object
}


function createMailing (data: MailingCreateData, id: number, listId: string): Mailing {
  return {
    html: data.html,
    id,
    listId,
    loadingFailedReceivers: false,
    locked: false,
    name: data.name,
    openForSubscription: false,
    receivers: data.receivers,
    receiversChanged: false,
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

function deleteReceiver (
  state: MailingListState, mailingId: number, receiverToDelete: string
): MailingListState {
  if (!state.byId[mailingId]) {
    return state;
  }

  const receiverList = state.byId[mailingId].receivers || [];

  return updateMailing(state, mailingId, {
    receivers: receiverList.filter(r => r.email !== receiverToDelete)
  });
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
    case ActionTypes.REMOVE_RECEIVER:
      return deleteReceiver(state, action.data.id, action.data.email);
    default:
      return state;
  }
}
