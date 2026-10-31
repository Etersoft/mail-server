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
  lightPreview: boolean;
  tabIndex: number;
}

// Выбор фона письма запоминается в браузере; хранилище может быть недоступно
const lightPreviewKey = 'editor-light-preview';

function loadLightPreview () {
  try {
    return localStorage.getItem(lightPreviewKey) === '1';
  } catch (e) {
    return false;
  }
}

function saveLightPreview (value: boolean) {
  try {
    localStorage.setItem(lightPreviewKey, value ? '1' : '0');
  } catch (e) {
    // не запомним — не страшно
  }
}

export class Editor extends React.Component<EditorProps, EditorState> {
  private editor: RichTextEditor | null;

  constructor (props: EditorProps) {
    super(props);
    this.state = {
      lightPreview: loadLightPreview(),
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

    // Ключ — номер вкладки: в названии может быть счётчик, он меняется
    const tabElements = tabs.map((tab, index) =>
      <Tab key={index}>{tab.name}</Tab>
    );
    const tabPanels = tabs.map((tab, index) =>
      <TabPanel key={index}>
        <div className={'editor-wrapper' + (this.state.lightPreview ? ' light-preview' : '')}>
          {tab.content}
        </div>
      </TabPanel>
    );
    // В тёмной теме письмо показывается тёмным; кнопка показывает его на
    // белом фоне, как у получателей со светлой темой
    const themeToggle = this.state.tabIndex === 0 ? (
      <button type='button' className='editor-theme-toggle'
              aria-pressed={this.state.lightPreview}
              onClick={this.handleLightPreviewToggle}>
        Светлый фон
      </button>
    ) : null;
    return (
      <Tabs selectedIndex={this.state.tabIndex} onSelect={this.handleTabSwitch}>
        <div className='editor-tabs-bar'>
          <TabList>
            {tabElements}
          </TabList>
          {themeToggle}
        </div>
        {tabPanels}
      </Tabs>
    );
  }

  private handleLightPreviewToggle = () => {
    const lightPreview = !this.state.lightPreview;
    saveLightPreview(lightPreview);
    this.setState({ lightPreview });
  };

  private handleRawHtmlChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    if (this.props.onChange) {
      this.props.onChange(event.currentTarget.value);
    }
  };

  private handleTabSwitch = (index: number) => {
    if (this.state.tabIndex === 0 && this.props.onChange) {
      this.props.onChange(pretty(this.props.html));
    }
    this.setState({
      tabIndex: index
    });
  };
}
