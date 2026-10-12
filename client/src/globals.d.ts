// Определяется вебпаком при сборке
declare const API_URL: string;
declare const BASE_URL: string;
declare const IMAGE_SERVICE_URL: string;

declare module 'pretty';

declare module '*.html' {
  const content: string;
  export default content;
}

declare module 'pell' {
  export function exec (cmd: any, arg?: any): any;
  export function init (config: any): any;
}
