import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';
import imageIcon from '@ckeditor/ckeditor5-core/theme/icons/image.svg';


export class ImageUploadPlugin extends Plugin {
  init () {
    const editor = this.editor;
    
    editor.ui.componentFactory.add('insertImage', (locale) => {
      const view = new ButtonView(locale);

      view.set({
        label: 'Insert image',
        icon: imageIcon,
        tooltip: true
      });

      view.on('execute', () => {
        this.insertImage();
      });

      return view;
    });
  }

  insertImage () {
    const editor = this.editor;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.addEventListener('change', async event => {
      const file = event.currentTarget.files && event.currentTarget.files[0];
      try {
        const fileLink = await this.uploadFile(file);
        console.log(fileLink);
        editor.model.change((writer) => {
          const imageElement = writer.createElement('image', {
            src: fileLink
          });
  
          editor.model.insertContent(imageElement, editor.model.document.selection);
        });
      } catch (error) {
        alert('Не удалось загрузить картинку.');
        console.error(error);
      }
    });
    fileInput.click();
  }

  async uploadFile (file) {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(IMAGE_SERVICE_URL + '/ul', {
      method: 'POST',
      body: form
    });
    const jsonResponse = await response.json();
    return IMAGE_SERVICE_URL + '/dl/' + jsonResponse.id + '/' + file.name;
  }
}
