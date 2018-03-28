export function success (data?: any) {
  const response: any = {
    success: true
  };

  if (data !== undefined) {
    response.data = data;
  }

  return response;
}

export function error (error: string): any {
  return {
    error,
    success: false
  };
}
