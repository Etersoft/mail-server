import * as React from 'react';
import '../../styles/FormGroup';


export interface FormGroupProps {
  horizontal?: boolean;
  stretch?: boolean;
  title: string;
}

export class FormGroup extends React.Component<FormGroupProps> {
  render () {
    return (
      <div className={this.constructClassName()}>
        <span className='input-name'>{this.props.title}</span>
        {this.props.children}
      </div>
    );
  }

  private constructClassName () {
    const classes = ['form-group'];
    if (this.props.stretch) {
      classes.push('stretch');
    }
    if (this.props.horizontal) {
      classes.push('horizontal');
    }
    return classes.join(' ');
  }
}
