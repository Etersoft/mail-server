import handlebars from 'handlebars';
import { AsyncTemplate } from './AsyncTemplate';
import { Receiver } from '../Receiver';


export class HandlebarsAsyncTemplate<Context> implements AsyncTemplate<Context> {
  private template: handlebars.TemplateDelegate<Context>;
  private templateExternalContent: Map<string, string> = new Map();
  private urlsForRequest: Array<string> = [];
  private receiverExternalContent: ReceiverData[] = [];
  private hasExternalContetn: boolean = false;
  private hbs = handlebars.create();

  constructor (source: string) {
    this.hbs.registerHelper(this.createHelpers());
    this.template = this.hbs.compile(source);
  }

  async render (context: Context, receiver: Receiver): Promise<string> {
    let html = this.template(context);
      if(this.hasExternalContetn) {
        await Promise.all([
          this.getTemplateExternalContent(this.urlsForRequest),
          this.getReceiverExternalContent(this.receiverExternalContent, receiver)
        ]);
        html = this.template(context); 
        this.receiverExternalContent = [];
        this.hasExternalContetn = false;
      }
    return html;
  }

  private async getTemplateExternalContent (urls: Array<string>) {
    if(this.hasUrlsForRequest()) {
      const requests = urls.map(url => fetchText(url));
      const externalContent: Array<string> = await Promise.all(requests);
      urls.forEach((url, index) => {
        this.templateExternalContent.set(url, externalContent[index]);
      });
    }
  }
  private async getReceiverExternalContent (dataForRequest: ReceiverData[], receiver: Receiver) {
    if(dataForRequest.length) {
      const requests = dataForRequest.map(({uri, data}) => {
      return fetchJson(uri, data || receiver.extraData);
    });
    const externalContent: Array<string> = await Promise.all(requests);
    externalContent.forEach((content, index) => {
      this.receiverExternalContent[index].content = content;
    });
    }
  }
  
  private readyForRender (url: string) {
    const request = this.receiverExternalContent.find(req => req.uri === url);
    return request && request.content;
  }

  private hasUrlsForRequest () {
    return this.urlsForRequest.filter(url => !this.templateExternalContent.get(url)).length;
  }

  private createHelpers () {
    return {
      external_content: (url: string) => {
        if(!this.templateExternalContent.get(url)) {
          this.hasExternalContetn = true;
          this.urlsForRequest.push(url);
          this.templateExternalContent.set(url, '');
          return '';
        } else {
          return new handlebars.SafeString(this.templateExternalContent.get(url) || '');
        }
      },
      external_content_with_receiver_data: (url: string, receiver: any) => {
        if(receiver.name && receiver.name === 'external_content_with_receiver_data' ) {
          receiver = null;
        }
        if(!this.readyForRender(url)) {
          this.hasExternalContetn = true;
          this.receiverExternalContent.push(new ReceiverData(url, receiver));
          return '';
        } else {
          return new handlebars.SafeString(this.readyForRender(url) || '');
        }
      }  
    };
  }
}

// Замена request-promise: ошибка при статусе не 2xx, как было там
async function fetchText (url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`External content ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

// POST с JSON-телом; ответ разбирается как JSON, если это возможно
// (как request с json: true), иначе возвращается текст
async function fetchJson (url: string, body: unknown): Promise<string> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`External content ${url}: HTTP ${response.status}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

class ReceiverData {
  uri: string;
  content: string;
  data: any;
  constructor (uri:string, requestData: any) {
    this.uri = uri;
    this.data = requestData;
    this.content = '';
  }
}
