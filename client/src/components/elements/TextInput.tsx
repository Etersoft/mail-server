import * as React from 'react';
import '../../styles/FormGroup';


export interface TextInputProps {
  disabled?: boolean;
  onChange?: (value: string) => void;
  placeholder?: string;
  value: string;
}

export class TextInput extends React.Component<TextInputProps> {
  render () {
    return (
      <input className='input' value={this.props.value} onChange={this.handleChange}
             placeholder={this.props.placeholder} disabled={this.props.disabled} />
    );
  }

  private handleChange = (event: React.FormEvent<HTMLInputElement>) => {
    if (this.props.onChange) {
      this.props.onChange(event.currentTarget.value);
    }
  }
}
