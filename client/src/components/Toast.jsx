import React from 'react';

export default function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`toast toast-${type}`}>{msg}</div>
  );
}
