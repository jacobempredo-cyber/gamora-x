import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import API_BASE_URL from '../config';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [queueCounts, setQueueCounts] = useState({});
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      const newSocket = io(API_BASE_URL, {
        reconnectionAttempts: 5,
        timeout: 10000,
      });

      newSocket.on('connect', () => {
        console.log('Socket.io connected successfully! ✅');
      });

      newSocket.on('online_count', (count) => {
        setOnlineCount(count);
      });

      newSocket.on('queue_counts', (counts) => {
        setQueueCounts(counts);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket.io connection error: ❌', error.message);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  }, [currentUser]);

  return (
    <SocketContext.Provider value={{ socket, onlineCount, queueCounts }}>
      {children}
    </SocketContext.Provider>
  );
}

// Hook exported separately to satisfy Vite's Fast Refresh rules
export const useSocket = () => {
  return useContext(SocketContext);
};
