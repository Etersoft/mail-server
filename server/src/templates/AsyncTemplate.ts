import { Receiver } from 'src/Receiver';

export interface AsyncTemplate<Context> {
  render (context: Context, receiver: Receiver): Promise<string>;
}