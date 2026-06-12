/*
 * Reusable animated toggle switch component styled to the ERIS design system.
 * Exports the default Switch component; consumed by every section inside features/settings/sections/
 * that needs a boolean on/off control. Supports the high-contrast theme variant via Tailwind modifiers.
 */
import React from 'react';

interface SwitchProps {
  active: boolean;
  onClick: () => void;
}

export default function Switch({ active, onClick }: SwitchProps) {
  return (
    <div
      onClick={onClick}
      className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ease-in-out border-2 ${
        active
          ? 'bg-eris-primary border-eris-primary [.theme-contrasted_&]:bg-white [.theme-contrasted_&]:border-white'
          : 'bg-gray-700 border-gray-700 [.theme-contrasted_&]:bg-transparent [.theme-contrasted_&]:border-white'
      }`}
    >
      <div
        className={`absolute top-[2.5px] w-4 h-4 rounded-full transition-all duration-200 ${
          active ? 'left-[22px] bg-white [.theme-contrasted_&]:bg-black' : 'left-[3px] bg-white'
        }`}
      />
    </div>
  );
}
