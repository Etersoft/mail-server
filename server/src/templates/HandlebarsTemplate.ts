import * as handlebars from 'handlebars';
import { Template } from './Template';


export class HandlebarsTemplate<Context> implements Template<Context> {
  private template: handlebars.TemplateDelegate<Context>;

  constructor (source: string) {
    this.template = handlebars.compile(source);
  }

  render (context: Context): string {
    return this.template(context);
  }
}
