import * as React from 'react';
import '../../styles/Button';


export interface ButtonProps {
  disabled?: boolean;
  onClick?: () => void;
}

export class Button extends React.Component<ButtonProps> {
  render () {
    return (
      <button className='button' disabled={this.props.disabled}
              onClick={this.props.onClick}>
        {this.props.children}
      </button>
    );
  }
}
