'use client';

import React from 'react';

interface SelectionRectangleProps {
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  isVisible: boolean;
}

export function SelectionRectangle({ rect, isVisible }: SelectionRectangleProps) {
  if (!isVisible || !rect || rect.width === 0 || rect.height === 0) {
    return null;
  }

  return (
    <div
      className="absolute pointer-events-none z-50 border-2 border-blue-500 bg-blue-500/10"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}
