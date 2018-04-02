import * as React from 'react';
import '../styles/HeaderEditor';
import { EditableHeader } from './EditableHeader';
import { Headers } from 'server/src/Mailing';


export interface HeaderEditorProps {
  headers: Headers;
  onChange: (headers: Headers) => void;
}

export interface HeaderEditorState {
  addingHeader: boolean;
  editingHeader: string | null;
}

export class HeaderEditor extends React.Component<HeaderEditorProps, HeaderEditorState> {
  constructor (props: HeaderEditorProps) {
    super(props);
    this.state = {
      addingHeader: false,
      editingHeader: null
    };
  }

  render () {
    const items = this.renderItems();
    return (
      <div className='list-block with-border header-list'>
        <h4 className='block-header'>
          Заголовки письма
          <div className='header-actions'>
            <button className='action' onClick={this.showAddForm}>
              Добавить
            </button>
          </div>
        </h4>
        <ul className='list'>
          {items}
        </ul>
      </div>
    );
  }

  private handleAdd = (name: string, value: string, addNext: boolean) => {
    if (!addNext) {
      this.setState({
        addingHeader: false
      });
    }
    if (!name.trim().length) {
      return;
    }
    this.props.onChange(Object.assign({}, this.props.headers, {
      [name]: value
    }));
  }

  private handleCancel = () => {
    this.setState({
      addingHeader: false,
      editingHeader: null
    });
  }

  private handleChange = (name: string, value: string) => {
    this.setState({
      editingHeader: null
    });
    if (!name.trim().length) {
      return;
    }
    this.props.onChange(Object.assign({}, this.props.headers, {
      [name]: value
    }));
  }

  private renderItems () {
    const headerList = Object.keys(this.props.headers);
    headerList.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const headerNodes = headerList.map(name => {
      if (name === this.state.editingHeader) {
        return (
          <EditableHeader key={name} name={name} value={this.props.headers[name]}
                          onChange={this.handleChange} onCancel={this.handleCancel} />
        );
      }
      return (
        <li key={name} className='header'>{name}: {this.props.headers[name]}</li>
      );
    });
    if (this.state.addingHeader) {
      headerNodes.push(
        <EditableHeader key='__new_header__' name='' value=''
                        onChange={this.handleAdd} onCancel={this.handleCancel} />
      );
    }
    return headerNodes;
  }

  private showAddForm = () => {
    this.setState({
      addingHeader: true
    });
  }
}
