import { stringify } from 'query-string';
import { Mailing } from 'client/src/reducers/mailings';


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

export function getMailings (): Promise<Mailing[]> {
  return apiRequest('/mailings');
}
