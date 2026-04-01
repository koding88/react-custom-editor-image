declare module "@editorjs/embed" {
  interface EmbedData {
    service: string;
    source: string;
    embed: string;
    width?: number;
    height?: number;
    caption?: string;
  }

  class Embed {
    constructor(...args: unknown[]);
    render(): HTMLElement;
    save(block: HTMLElement): EmbedData;
  }
  export default Embed;
}
