import * as React from 'react';
import '../../styles/ConfirmationButton';
import { Button, ButtonType } from './Button';


export interface ConfirmationButtonProps {
  disabled?: boolean;
  onClick?: () => void;
  type?: ButtonType;
  typeNo?: ButtonType;
  typeYes?: ButtonType;
}

interface ConfirmationButtonState {
  active: boolean;
}

export class ConfirmationButton extends React.Component<
  ConfirmationButtonProps, ConfirmationButtonState
> {
  constructor (props: ConfirmationButtonProps) {
    super(props);
    this.state = {
      active: false
    };
  }

  render () {
    if (this.state.active && !this.props.disabled) {
      return (
        <div className='confirmation-button active'>
          <span className='comment'>Вы уверены?</span>
          <Button small type={this.props.typeYes} onClick={this.handleAccept}>Да</Button>
          <Button small type={this.props.typeNo} onClick={this.handleReject}>Нет</Button>
        </div>
      );
    } else {
      return (
        <div className='confirmation-button'>
          <Button disabled={this.props.disabled} type={this.props.type}
                  onClick={this.handleInitialClick}>
            {this.props.children}
          </Button>
        </div>
      );
    }
  }

  private handleAccept = () => {
    this.setState({
      active: false
    });
    if (this.props.onClick) {
      this.props.onClick();
    }
  }

  private handleInitialClick = () => {
    this.setState({
      active: true
    });
  }

  private handleReject = () => {
    this.setState({
      active: false
    });
  }
}
