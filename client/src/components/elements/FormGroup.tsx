import * as React from 'react';
import '../../styles/FormGroup';


export interface FormGroupProps {
  children?: React.ReactNode;
  fraction?: number;
  horizontal?: boolean;
  // id поля ввода: подпись становится <label> и щелчок по ней ставит курсор в поле
  htmlFor?: string;
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
      this.props.htmlFor ? (
        <label className='input-name' htmlFor={this.props.htmlFor}>{this.props.title}</label>
      ) : (
        <span className='input-name'>{this.props.title}</span>
      )
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
