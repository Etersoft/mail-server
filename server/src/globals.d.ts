declare module 'cron-converter' {
  class Cron {
    public fromString (cronString: string): void;
    public toArray (): number[][];
  }

  export = Cron;
}
