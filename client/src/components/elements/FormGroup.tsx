import * as React from 'react';
import '../../styles/FormGroup';


export interface FormGroupProps {
  fraction?: number;
  horizontal?: boolean;
  inline?: boolean;
  stretch?: boolean;
  title?: string;
}

export class FormGroup extends React.Component<FormGroupProps> {
  render () {
    const style: any = {};
    if (this.props.fraction) {
      style.flex = this.props.fraction;
    }
    const title = this.props.title ? (
      <span className='input-name'>{this.props.title}</span>
    ) : null;
    return (
      <div className={this.constructClassName()} style={style}>
        {title}
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
    if (this.props.inline) {
      classes.push('inline');
    }
    return classes.join(' ');
  }
}
