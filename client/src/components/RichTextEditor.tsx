import * as React from 'react';
import { init, exec } from 'pell';
import 'pell/dist/pell.css';


export interface RichTextEditorProps {
  html: string;
  onChange?: (value: string) => void;
}

export class RichTextEditor extends React.Component<
  RichTextEditorProps
> {
  private container: HTMLDivElement;
  private editor: any;

  render () {
    return <div className='pell-container' ref={this.mountEditor}></div>;
  }

  private handleChange = (html: string) => {
    if (this.props.onChange) {
      this.props.onChange(html);
    }
  }

  private insertImage = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.addEventListener('change', async (event: any) => {
      const file = event.currentTarget.files && event.currentTarget.files[0];
      try {
        const fileLink = await this.uploadFile(file);
        exec('insertImage', fileLink);
        const image = this.container.querySelector(
          `.pell-content img[src="${fileLink}"]`
        ) as HTMLImageElement;
        if (image) {
          image.width = 500;
          this.handleChange(this.editor.content.innerHTML);
        }
      } catch (error) {
        alert('Не удалось загрузить картинку.');
        // tslint:disable-next-line no-console
        console.error(error);
      }
    });
    fileInput.click();
  }

  private mountEditor = (ref: HTMLDivElement | null) => {
    if (ref) {
      this.container = ref;
      this.editor = init({
        actions: [
          'bold',
          'italic',
          'underline',
          'strikethrough',
          'heading1',
          'heading2',
          'paragraph',
          'olist',
          'ulist',
          'code',
          'line',
          {
            icon: '<small>Aa-</small>',
            name: 'font-small',
            result: () => exec('fontSize', 1),
            title: 'Мелкий шрифт'
          },
          {
            icon: 'Aa',
            name: 'font-normal',
            result: () => exec('fontSize', 3),
            title: 'Обычный шрифт'
          },
          {
            icon: '<big>Aa+</big>',
            name: 'font-large',
            result: () => exec('fontSize', 5),
            title: 'Крупный шрифт'
          },
          {
            icon: '&lt;a href=...&gt;',
            name: 'link',
            title: 'Ссылка'
          },
          {
            icon: '&lt;img&gt;',
            name: 'image',
            result: this.insertImage,
            title: 'Вставить изображение'
          }
        ],
        element: ref,
        onChange: this.handleChange
      });
      this.editor.content.innerHTML = this.props.html;
    }
  }

  private async uploadFile (file: File) {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(IMAGE_SERVICE_URL + '/ul', {
      body: form,
      method: 'POST'
    });
    const jsonResponse = await response.json();
    return IMAGE_SERVICE_URL + '/dl/' + jsonResponse.id + '/' + file.name;
  }
}
