import * as React from 'react';
import { Loading } from './elements/Loading';
import '../styles/CKEditor';


export interface CKEditorProps {
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
    const content = this.state.editorModule ? (
      <textarea ref={this.mountEditor}></textarea>
    ) : <Loading>Загрузка редактора...</Loading>;
    return (
      <div className='editor-wrapper'>
        {content}
      </div>
    );
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
