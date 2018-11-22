import * as React from 'react';


export interface CheckboxProps {
  onChange?: (value: boolean) => void;
  value: boolean;
}

export class Checkbox extends React.Component<CheckboxProps> {
  render () {
    return (
      <input type='checkbox' onChange={this.handleChange} checked={this.props.value} />
    );
  }

  private handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (this.props.onChange) {
      this.props.onChange(event.target.checked);
    }
  }
}
