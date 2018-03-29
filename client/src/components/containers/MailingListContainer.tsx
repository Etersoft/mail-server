import { connect } from 'react-redux';
import { MailingList, MailingListProps } from '../MailingList';
import { Dispatch } from 'redux';
import { RootState } from '../../reducers/index';
import { selectMailing } from '../../actions/selectMailing';
import { Mailing } from '../../reducers/mailings';


function mapStateToProps (state: RootState) {
  return {
    mailings: state.mailings.ids.map(id => state.mailings.byId[id]),
    selectedMailing: state.mailings.selected
  };
}

function mapDispatchToProps (dispatch: Dispatch<RootState>) {
  return {
    onSelect (mailing: Mailing): void {
      dispatch(selectMailing(mailing));
    }
  };
}

export const MailingListContainer = connect<MailingListProps>(
  mapStateToProps, mapDispatchToProps
)(MailingList);
