import React from 'react';
import { avatarColor, initials } from '../utils/helpers.js';

export default function Avatar({ name = '', color, size = 40, avatarUrl }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        style={{
          borderRadius: '50%',
          display: 'block',
          flexShrink: 0,
          objectFit: 'cover',
          width: size,
          height: size,
        }}
      />
    );
  }
  const bg  = color || avatarColor(name);
  const ini = initials(name);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}
      style={{ borderRadius: '50%', display: 'block', flexShrink: 0 }}>
      <rect width={size} height={size} fill={bg} rx={size / 2}/>
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fontFamily="Nunito, sans-serif" fontWeight="800"
        fontSize={size * 0.40} fill="white">{ini}</text>
    </svg>
  );
}
