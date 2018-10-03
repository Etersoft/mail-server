import * as React from 'react';
import { RichTextEditor } from './RichTextEditor';
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
  tabIndex: number;
}

export class Editor extends React.Component<EditorProps, EditorState> {
  private editor: RichTextEditor | null;

  constructor (props: EditorProps) {
    super(props);
    this.state = {
      tabIndex: 0
    };
  }

  render () {
    const tabs = [
      {
        content: (
          <RichTextEditor onChange={this.props.onChange} html={this.props.html}
                          ref={editor => this.editor = editor} />
        ),
        name: 'Редактор'
      },
      {
        content: (
          <textarea value={this.props.html} onChange={this.handleRawHtmlChange}>
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

  private handleRawHtmlChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    if (this.props.onChange) {
      this.props.onChange(event.currentTarget.value);
    }
  }

  private handleTabSwitch = (index: number) => {
    if (this.state.tabIndex === 0 && this.props.onChange) {
      this.props.onChange(pretty(this.props.html));
    }
    this.setState({
      tabIndex: index
    });
  }
}
