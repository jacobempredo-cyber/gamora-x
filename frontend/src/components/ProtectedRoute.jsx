import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { currentUser, userProfile, profileLoading } = useAuth();

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  // Wait for userProfile to load before making any access decisions
  if (profileLoading || !userProfile) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#0f0a1f]">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-t-4 border-b-4 border-cyan-500 rounded-full animate-spin"></div>
          <div className="absolute inset-4 border-r-4 border-l-4 border-purple-500 rounded-full animate-spin-reverse opacity-70"></div>
        </div>
      </div>
    );
  }

  const isAdmin = userProfile?.isAdmin || userProfile?.role === 'admin';

  // If route requires admin but user is not admin, redirect to dashboard
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Auto-redirect Admin to Management Hub if they hit a player route
  if (!requireAdmin && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
