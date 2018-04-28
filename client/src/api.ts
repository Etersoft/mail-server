import { stringify } from 'query-string';
import { Mailing, Receiver } from './reducers/mailings';
import { MailingCreateData } from './components/AddForm';


type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function apiRequest (
  endpoint: string, method: HttpMethod = 'GET', queryParams?: any, data?: any
): Promise<any> {
  const requestConfig: any = {
    credentials: 'include',
    headers: {
      'content-type': 'application/json'
    },
    method
  };

  if (queryParams !== undefined && queryParams !== null) {
    endpoint += '?' + stringify(queryParams);
  }

  if (data !== undefined) {
    requestConfig.body = JSON.stringify(data);
  }

  let response;
  try {
    response = await fetch(API_URL + endpoint, requestConfig);
  } catch (error) {
    throw error;
  }

  const jsonResponse = await response.json();

  if (!response.ok || !jsonResponse.success) {
    throw new Error(
      `Endpoint ${endpoint} replied with ${response.status}: ${jsonResponse.error}`
    );
  }

  return jsonResponse.data;
}

export async function createMailing (mailing: MailingCreateData): Promise<{
  id: number; listId: string;
}> {
  return apiRequest('/mailings', 'POST', null, mailing);
}

export function deleteMailing (id: number): Promise<void> {
  return apiRequest('/mailings/' + id, 'DELETE');
}

export function getMailingById (id: number): Promise<Mailing> {
  return apiRequest(`/mailings/${id}`);
}

export function getMailings (): Promise<Mailing[]> {
  return apiRequest('/mailings');
}

export function getFailedReceivers (id: number): Promise<Receiver[]> {
  return apiRequest(`/mailings/${id}/failed-receivers`);
}

export function getReceivers (id: number): Promise<Receiver[]> {
  return apiRequest(`/mailings/${id}/receivers`);
}

export function sendTestEmail (mailingId: number, email: string): Promise<void> {
  return apiRequest(`/mailings/${mailingId}/send-test-email`, 'POST', null, {
    email
  });
}

export async function updateMailing (id: number, data: any): Promise<void> {
  await apiRequest('/mailings/' + id, 'PUT', null, data);
}
