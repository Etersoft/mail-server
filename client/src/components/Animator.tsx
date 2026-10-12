import * as React from 'react';
import { CSSTransition, TransitionGroup } from 'react-transition-group';


export interface AnimatorProps {
  // Получает ref, который нужно повесить на корневой DOM-элемент содержимого:
  // на него ставятся классы анимации switch-*
  children: (nodeRef: React.RefObject<HTMLDivElement>) => React.ReactNode;
  show: boolean;
}

const ANIMATION_TIMEOUT = 350;

export class Animator extends React.Component<AnimatorProps> {
  // nodeRef избавляет react-transition-group от устаревшего findDOMNode
  private nodeRef = React.createRef<HTMLDivElement>();

  render () {
    const content = this.props.show ? (
      <CSSTransition classNames='switch' nodeRef={this.nodeRef} timeout={ANIMATION_TIMEOUT}>
        {this.props.children(this.nodeRef)}
      </CSSTransition>
    ) : null;
    return (
      <TransitionGroup component={null}>
        {content}
      </TransitionGroup>
    );
  }
}
