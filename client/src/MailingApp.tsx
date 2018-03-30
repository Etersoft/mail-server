import { createStore, applyMiddleware, Store } from 'redux';
import * as React from 'react';
import { Provider } from 'react-redux';
import rootReducer, { RootState } from './reducers';
import { render } from 'react-dom';
import { RootViewContainer } from './components/containers/RootViewContainer';
import thunk from 'redux-thunk';
import { loadMailings } from './actions/loadMailings';
import { reloadMailingsData } from './actions/reloadMailingsData';


export class MailingApp {
  private store: Store<RootState>;

  constructor (private rootNode: HTMLElement) {
    this.start();
  }

  private async start () {
    this.store = createStore(
      rootReducer,
      applyMiddleware(thunk)
    );
    const component = (
      <Provider store={this.store}>
        <RootViewContainer />
      </Provider>
    );
    render(component, this.rootNode);
    this.store.dispatch(loadMailings());
    setInterval(() => {
      this.store.dispatch(reloadMailingsData());
    }, 5000);
  }
}
