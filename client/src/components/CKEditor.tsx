import * as React from 'react';
import { Loading } from './elements/Loading';
import Essentials from '@ckeditor/ckeditor5-essentials/src/essentials';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import Bold from '@ckeditor/ckeditor5-basic-styles/src/bold';
import Italic from '@ckeditor/ckeditor5-basic-styles/src/italic';
import Image from '@ckeditor/ckeditor5-image/src/image';
import Heading from '@ckeditor/ckeditor5-heading/src/heading';
import Blockquote from '@ckeditor/ckeditor5-block-quote/src/blockquote';
import Link from '@ckeditor/ckeditor5-link/src/link';
import List from '@ckeditor/ckeditor5-list/src/list';
import { ImageUploadPlugin } from './ImageUploadPlugin';


export interface CKEditorProps {
  html: string;
  onChange?: (value: string) => void;
}

interface CKEditorState {
  editorModule: any;
}

export class CKEditor extends React.Component<CKEditorProps, CKEditorState> {
  private editor: any;

  constructor (props: CKEditorProps) {
    super(props);
    this.state = {
      editorModule: null
    };
  }

  componentDidMount () {
    this.loadEditor();
  }

  getContent () {
    return this.editor.getData();
  }

  render () {
    return this.state.editorModule ? (
      <textarea ref={this.mountEditor} defaultValue={this.props.html}></textarea>
    ) : <Loading>Загрузка редактора...</Loading>;
  }

  reset (html: string) {
    this.editor.setData(html);
  }

  private async loadEditor () {
    const { default: ClassicEditor } = await import('@ckeditor/ckeditor5-build-classic');
    this.setState({
      editorModule: ClassicEditor
    });
  }

  private mountEditor = async (ref: HTMLTextAreaElement | null) => {
    if (ref) {
      this.state.editorModule.build.plugins.push(ImageUploadPlugin);
      this.editor = await this.state.editorModule.create(ref, {
        toolbar: [
          'undo', 'redo', '|', 'heading', '|', 'bold', 'italic', 'link', 'bulletedList',
          'numberedList', 'blockQuote', 'insertImage'
        ]
      });
      this.editor.model.document.on('change', () => {
        const documentChanged = this.editor.model.document.differ.getChanges().length > 0;
        if (this.props.onChange && documentChanged) {
          this.props.onChange(this.getContent());
        }
      });
    } else {
      await this.editor.destroy();
    }
  }
}
