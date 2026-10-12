import { MailingApp } from './MailingApp';


const root = document.getElementById('root');
if (!root) {
  console.error('Root not found');
} else {
  new MailingApp(root);
}
