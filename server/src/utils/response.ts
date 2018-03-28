export function success (data?: any) {
  const response: any = {
    success: true
  };

  if (data !== undefined) {
    response.data = data;
  }

  return response;
}

export function error (errorText: string): any {
  return {
    error: errorText,
    success: false
  };
}
