import { legacy_createStore as createStore, applyMiddleware, Store } from 'redux';
import * as React from 'react';
import { Provider } from 'react-redux';
import rootReducer, { RootState } from './reducers';
import { createRoot } from 'react-dom/client';
import { RootViewContainer } from './components/containers/RootViewContainer';
import { thunk } from 'redux-thunk';
import { loadMailings } from './actions/loadMailings';
import { reloadMailingsData } from './actions/reloadMailingsData';
import { AppDispatch } from './types';


export class MailingApp {
  private store: Store<RootState> & { dispatch: AppDispatch };

  constructor (private rootNode: HTMLElement) {
    this.start();
  }

  private async start () {
    this.store = createStore(
      rootReducer,
      applyMiddleware(thunk)
    ) as unknown as Store<RootState> & { dispatch: AppDispatch };
    const component = (
      <Provider store={this.store}>
        <RootViewContainer />
      </Provider>
    );
    createRoot(this.rootNode).render(component);
    this.store.dispatch(loadMailings());
    setInterval(() => {
      this.store.dispatch(reloadMailingsData());
    }, 5000);
  }
}
