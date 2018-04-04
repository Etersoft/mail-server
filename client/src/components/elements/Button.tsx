import * as React from 'react';
import '../../styles/Button';


export enum ButtonType {
  DEFAULT, DANGER
}

export interface ButtonProps {
  disabled?: boolean;
  onClick?: () => void;
  type?: ButtonType;
}

export class Button extends React.Component<ButtonProps> {
  public static defaultProps: Partial<ButtonProps> = {
    type: ButtonType.DEFAULT
  };

  render () {
    const className = this.getClassName();
    return (
      <button className={`button ${className}`} disabled={this.props.disabled}
              onClick={this.props.onClick}>
        {this.props.children}
      </button>
    );
  }

  private getClassName () {
    return {
      [ButtonType.DEFAULT]: 'default',
      [ButtonType.DANGER]: 'danger'
    }[this.props.type!] || '';
  }
}
