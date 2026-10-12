import * as React from 'react';
import { NotificationItem } from '../reducers/notifications';
import '../styles/Notifications';


export interface NotificationsProps {
  notifications: NotificationItem[];
  onDismiss: (id: number) => void;
}

export function Notifications ({ notifications, onDismiss }: NotificationsProps) {
  return (
    <div className='notifications'>
      {notifications.map(item => (
        <div key={item.id} className={'notification notification-' + item.level}
             onClick={() => onDismiss(item.id)}>
          {item.title ? <h4 className='notification-title'>{item.title}</h4> : null}
          <div className='notification-message'>{item.message}</div>
        </div>
      ))}
    </div>
  );
}
