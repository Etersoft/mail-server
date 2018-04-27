import * as React from 'react';
import { CSSTransition, TransitionGroup } from 'react-transition-group';


export interface AnimatorProps {
  show: boolean;
}

const ANIMATION_TIMEOUT = 350;

export class Animator extends React.Component<AnimatorProps> {
  render () {
    const transitionProps = {
      classNames: 'switch',
      timeout: ANIMATION_TIMEOUT
    };
    const content = this.props.show ? (
      <CSSTransition {...transitionProps}>
        {() => this.props.children}
      </CSSTransition>
    ) : null;
    return (
      <TransitionGroup>
        {content}
      </TransitionGroup>
    );
  }
}
