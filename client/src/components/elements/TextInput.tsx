import * as React from 'react';
import '../../styles/FormGroup';


export interface TextInputProps {
  disabled?: boolean;
  id?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email';
  value: string;
}

export class TextInput extends React.Component<TextInputProps> {
  render () {
    return (
      <input className='input' value={this.props.value} onChange={this.handleChange}
             id={this.props.id} type={this.props.type || 'text'}
             placeholder={this.props.placeholder} disabled={this.props.disabled} />
    );
  }

  private handleChange = (event: React.FormEvent<HTMLInputElement>) => {
    if (this.props.onChange) {
      this.props.onChange(event.currentTarget.value);
    }
  };
}
