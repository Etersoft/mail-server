export function success (data?: any) {
  const response: any = {
    success: true
  };

  if (data !== undefined) {
    response.data = data;
  }

  return response;
}

export function error (errorText: string, errorCode?: string): any {
  return {
    code: errorCode,
    error: errorText,
    success: false
  };
}
