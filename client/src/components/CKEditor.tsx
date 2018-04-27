import * as React from 'react';
import { Loading } from './elements/Loading';


export interface CKEditorProps {
  html: string;
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

  private async loadEditor () {
    const { default: ClassicEditor } = await import('@ckeditor/ckeditor5-build-classic');
    this.setState({
      editorModule: ClassicEditor
    });
  }

  private mountEditor = async (ref: HTMLTextAreaElement | null) => {
    if (ref) {
      this.editor = await this.state.editorModule.create(ref);
    } else {
      await this.editor.destroy();
    }
  }
}
