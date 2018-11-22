export interface Template<Context> {
  render (context: Context): string;
}
