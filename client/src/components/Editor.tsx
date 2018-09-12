import * as React from 'react';
import { CKEditor } from './CKEditor';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.scss';
import * as pretty from 'pretty';


export interface EditorProps {
  additionalTabs?: ReadonlyArray<{
    content: JSX.Element; name: string;
  }>;
  html: string;
  onChange?: (value: string) => void;
}

interface EditorState {
  rawHtml: string;
  tabIndex: number;
}

export class Editor extends React.Component<EditorProps, EditorState> {
  private editor: CKEditor | null;

  constructor (props: EditorProps) {
    super(props);
    this.state = {
      rawHtml: props.html,
      tabIndex: 0
    };
  }

  getContent () {
    if (this.showRawHtml) {
      return this.state.rawHtml;
    } else if (this.editor) {
      return this.editor.getContent();
    }
  }

  render () {
    const tabs = [
      {
        content: (
          <CKEditor onChange={this.props.onChange} html={this.state.rawHtml}
                    ref={editor => this.editor = editor} />
        ),
        name: 'Редактор'
      },
      {
        content: (
          <textarea value={this.state.rawHtml} onChange={this.handleRawHtmlChange}>
          </textarea>
        ),
        name: 'HTML'
      }
    ].concat(this.props.additionalTabs || []);

    const tabElements = tabs.map(tab =>
      <Tab key={tab.name}>{tab.name}</Tab>
    );
    const tabPanels = tabs.map(tab =>
      <TabPanel key={tab.name}>
        <div className='editor-wrapper'>
          {tab.content}
        </div>
      </TabPanel>
    );
    return (
      <Tabs selectedIndex={this.state.tabIndex} onSelect={this.handleTabSwitch}>
        <TabList>
          {tabElements}
        </TabList>
        {tabPanels}
      </Tabs>
    );
  }

  reset (html: string) {
    this.setState({
      rawHtml: html
    });
    if (this.editor) {
      this.editor.reset(html);
    }
  }

  private handleRawHtmlChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    this.setState({
      rawHtml: event.currentTarget.value
    });
    if (this.props.onChange) {
      this.props.onChange(event.currentTarget.value);
    }
  }

  private handleTabSwitch = (index: number) => {
    if (index === 1 && this.editor) {
      this.setState({
        rawHtml: pretty(this.editor.getContent()),
        tabIndex: index
      });
    } else {
      this.setState({
        tabIndex: index
      });
    }
  }

  private get showRawHtml () {
    return this.state.tabIndex === 1;
  }
}
