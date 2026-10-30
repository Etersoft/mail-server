import * as React from 'react';


export interface CheckboxProps {
  children?: React.ReactNode;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
  value: boolean;
}

// С подписью (children) флажок переключается и щелчком по тексту
export class Checkbox extends React.Component<CheckboxProps> {
  render () {
    const input = (
      <input type='checkbox' onChange={this.handleChange} checked={this.props.value}
             disabled={this.props.disabled} />
    );
    if (!this.props.children) {
      return input;
    }
    return (
      <label className='checkbox'>
        {input}
        <span>{this.props.children}</span>
      </label>
    );
  }

  private handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (this.props.onChange) {
      this.props.onChange(event.target.checked);
    }
  };
}
