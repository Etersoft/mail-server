import * as React from 'react';
import '../../styles/Button';


export enum ButtonType {
  DEFAULT, DANGER, PRIMARY
}

export interface ButtonProps {
  children?: React.ReactNode;
  disabled?: boolean;
  label?: string;
  onClick?: () => void;
  small?: boolean;
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
              aria-label={this.props.label} title={this.props.label}
              onClick={this.props.onClick}>
        {this.props.children}
      </button>
    );
  }

  private getClassName () {
    let className = {
      [ButtonType.DEFAULT]: 'default',
      [ButtonType.DANGER]: 'danger',
      [ButtonType.PRIMARY]: 'primary'
    }[this.props.type!] || '';
    if (this.props.small) {
      className += ' small';
    }
    return className;
  }
}
