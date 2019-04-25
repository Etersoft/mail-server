import * as handlebars from 'handlebars';
import { AsyncTemplate } from './AsyncTemplate';
import * as request from 'request-promise';


export class HandlebarsAsyncTemplate<Context> implements AsyncTemplate<Context> {
  private template: handlebars.TemplateDelegate<Context>;
  private urlsContent: Map<string, string> = new Map();
  private urlsForRequest: Array<string> = [];
  private hbs = handlebars.create();

  constructor (source: string) {
    this.hbs.registerHelper('external_content', (url: string) => {
      if(!this.urlsContent.get(url)) {
        this.urlsForRequest.push(url);
        this.urlsContent.set(url, '');
        return '';
      } else {
        return new handlebars.SafeString(this.urlsContent.get(url) || '');
      }
    });
    this.template = this.hbs.compile(source);
  }

  async render (context: Context): Promise<string> {
    const html = this.template(context);
    if(this.urlsForRequest.length) {
      for (const url of this.urlsForRequest) {
        if (!this.urlsContent.get(url)) {
          try {
            const content = await request(url);
            this.urlsContent.set(url, content);
          } catch (error) {
              throw error; 
          }
        }
      }
      return this.template(context); 
    }
    return html;
  }
}
