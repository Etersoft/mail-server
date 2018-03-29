import { MailingApp } from './MailingApp';


const root = document.getElementById('root');
if (!root) {
  // tslint:disable-next-line:no-console
  console.error('Root not found');
} else {
  const app = new MailingApp(root);
}
