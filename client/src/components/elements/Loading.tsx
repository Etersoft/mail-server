import * as React from 'react';


export class Loading extends React.Component<{ children?: React.ReactNode }> {
  render () {
    return (
      <span className='loading'>
        {this.props.children}
      </span>
    );
  }
}
