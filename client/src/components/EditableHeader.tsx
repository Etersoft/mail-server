import * as React from 'react';
import onClickOutside, { InjectedOnClickOutProps } from 'react-onclickoutside';
import '../styles/EditableHeader';
import { KeyboardEvent } from 'react';


export interface EditableHeaderProps {
  name: string;
  onCancel: () => void;
  onChange: (name: string, value: string, addNext: boolean) => void;
  value: string;
}

export interface EditableHeaderState {
  name: string;
  value: string;
}

class EditableHeaderRaw extends React.Component<
  EditableHeaderProps & InjectedOnClickOutProps, EditableHeaderState
> {
  private nameInput: HTMLInputElement | null;

  constructor (props: EditableHeaderProps & InjectedOnClickOutProps) {
    super(props);
    this.state = {
      name: props.name,
      value: props.value
    };
  }

  componentDidMount () {
    if (this.nameInput) {
      this.nameInput.focus();
    }
  }

  handleClickOutside = () => {
    this.props.onChange(this.state.name, this.state.value, false);
  }

  render () {
    return (
      <span className='editable-header'>
        <input className='input header-name' onChange={this.handleNameChange}
               onKeyDown={this.handleKeyDown}
               value={this.state.name} placeholder='Заголовок' ref={el => this.nameInput = el} />
        <span className='field-separator'>:</span>
        <input className='input header-value' onChange={this.handleValueChange}
               onKeyDown={this.handleKeyDown}
               value={this.state.value} placeholder='Значение' />
      </span>
    );
  }

  private handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      if (this.nameInput) {
        this.nameInput.focus();
        this.nameInput.scrollIntoView();
      }
      this.props.onChange(this.state.name, this.state.value, true);
      this.setState({
        name: '',
        value: ''
      });
    } else if (event.key === 'Escape') {
      this.props.onCancel();
    }
  }

  private handleNameChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({
      name: event.currentTarget.value
    });
  }

  private handleValueChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({
      value: event.currentTarget.value
    });
  }

  private setFocus = (element: HTMLInputElement | null) => {
    if (element) {
      element.focus();
    }
  }
}

const EditableHeaderWrapped = onClickOutside<EditableHeaderProps>(EditableHeaderRaw);

export { EditableHeaderWrapped as EditableHeader };
