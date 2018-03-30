import * as React from 'react';


export class Loading extends React.Component {
  render () {
    return (
      <span className='loading'>
        {this.props.children}
      </span>
    );
  }
}
