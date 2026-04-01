import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { currentUser, userProfile } = useAuth();

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  // If route requires admin but user is not admin, redirect to dashboard
  if (requireAdmin && userProfile && !userProfile.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Wait for userProfile to load before rendering admin content
  if (requireAdmin && !userProfile) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#0f0a1f]">
        <div className="w-12 h-12 border-t-4 border-b-4 border-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return children;
}
