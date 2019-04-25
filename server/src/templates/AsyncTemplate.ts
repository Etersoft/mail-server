export interface AsyncTemplate<Context> {
  render (context: Context): Promise<string>;
}
