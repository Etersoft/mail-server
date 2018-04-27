import * as React from 'react';
import { CKEditor } from './CKEditor';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.scss';
import * as pretty from 'pretty';


export interface EditorProps {
  initialHtml: string;
}

interface EditorState {
  rawHtml: string;
  showRawHtml: boolean;
}

export class Editor extends React.Component<EditorProps, EditorState> {
  private editor: CKEditor | null;

  constructor (props: EditorProps) {
    super(props);
    this.state = {
      rawHtml: props.initialHtml,
      showRawHtml: false
    };
  }

  getContent () {
    if (this.state.showRawHtml) {
      return this.state.rawHtml;
    } else if (this.editor) {
      return this.editor.getContent();
    }
  }

  render () {
    return (
      <Tabs selectedIndex={this.state.showRawHtml ? 1 : 0} onSelect={this.handleTabSwitch}>
        <TabList>
          <Tab>Редактор</Tab>
          <Tab>HTML</Tab>
        </TabList>
        <TabPanel>
          <div className='editor-wrapper'>
            <CKEditor html={this.state.rawHtml} ref={editor => this.editor = editor} />
          </div>
        </TabPanel>
        <TabPanel>
          <div className='editor-wrapper'>
            <textarea value={this.state.rawHtml} onChange={this.handleRawHtmlChange}>
            </textarea>
          </div>
        </TabPanel>
      </Tabs>
    );
  }

  private handleRawHtmlChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    this.setState({
      rawHtml: event.currentTarget.value
    });
  }

  private handleTabSwitch = (index: number) => {
    if (index === 1 && this.editor) {
      this.setState({
        rawHtml: pretty(this.editor.getContent()),
        showRawHtml: true
      });
    } else {
      this.setState({
        showRawHtml: false
      });
    }
  }
}
