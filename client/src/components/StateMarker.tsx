import * as React from 'react';
import { MailingState } from 'server/src/Mailing';
import '../styles/StateMarker';


export interface StateMarkerProps {
  state: MailingState;
}

export class StateMarker extends React.PureComponent<StateMarkerProps> {
  render () {
    const markerClass = MailingState[this.props.state].toLowerCase();
    return (
      <span className={`state-marker ${markerClass}`}></span>
    );
  }
}
